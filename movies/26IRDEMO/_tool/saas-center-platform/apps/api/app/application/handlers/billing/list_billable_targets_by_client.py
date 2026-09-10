import math

from app.application.schemas import (
    BillableTarget,
    BillableTargetCounts,
    BillableTargetListResponse,
    BillableTargetReference,
)
from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork


async def list_billable_targets_by_client_handler(
    *,
    center_id: str,
    client_id: str,
    type_filter: str | None = None,
    include_billed: bool = False,
    page: int = 1,
    size: int = 10,
    uow: UnitOfWork,
) -> BillableTargetListResponse:
    # Lazy import — 순환 참조 방지 (billing router → application.handlers.billing → billing.facade)
    from app.modules.assessment.facade import (
        AssessmentCaseFacade,
        AssessmentSessionFacade,
        AssessmentSetFacade,
        AssessmentTaskFacade,
    )
    from app.modules.billing.facade import BillableFacade
    from app.modules.center.facade import ProgramFacade
    from app.modules.counseling.facade import (
        CounselingCaseFacade,
        CounselingSessionFacade,
    )
    from app.modules.schedule.facade import ScheduleFacade

    targets: list[BillableTarget] = []

    # 검사
    assessment_case_facade = AssessmentCaseFacade(uow)
    assessment_session_facade = AssessmentSessionFacade(uow)
    assessment_task_facade = AssessmentTaskFacade(uow)
    assessment_set_facade = AssessmentSetFacade(uow)
    billable_facade = BillableFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    assessment_cases = await assessment_case_facade.get_cases_by_client(
        center_id=center_id,
        client_id=client_id,
    )
    if assessment_cases:
        case_ids = [c.id for c in assessment_cases]
        case_by_id = {c.id: c for c in assessment_cases}

        a_sessions = await assessment_session_facade.get_sessions_by_case_ids(case_ids)
        a_sessions = [s for s in a_sessions if s.status != "cancelled"]

        # 청구는 session 또는 case 단위로 묶일 수 있어 두 related_type 모두 확인
        billed_ids: set[str] = set()
        # 세션 없이 case 단위로 청구된 케이스 (일정 없는 검사 대응)
        billed_case_ids: set[str] = set()
        if not include_billed:
            for rt in ("assessment_session", "assessment_case"):
                billed_ids |= await billable_facade.list_billed_session_ids(
                    center_id=center_id,
                    client_id=client_id,
                    related_type=rt,
                )
            billed_case_ids = await billable_facade.list_billed_case_ids(
                center_id=center_id,
                client_id=client_id,
                related_type="assessment_case",
            )

        schedule_ids = [s.schedule_id for s in a_sessions if s.schedule_id]
        schedules = await schedule_facade.list_schedules_by_ids(schedule_ids)
        schedule_map = {sch.id: sch for sch in schedules}

        references_by_case: dict[str, list[BillableTargetReference]] = {}
        for case in assessment_cases:
            references_by_case[case.id] = await _build_assessment_references(
                case=case,
                center_id=center_id,
                task_facade=assessment_task_facade,
                set_facade=assessment_set_facade,
            )

        cases_with_sessions = {s.case_id for s in a_sessions}

        for session in a_sessions:
            if session.id in billed_ids:
                continue
            case = case_by_id.get(session.case_id)
            if not case:
                continue

            title, subtitle = _format_assessment_labels(case)

            schedule = (
                schedule_map.get(session.schedule_id) if session.schedule_id else None
            )
            targets.append(
                BillableTarget(
                    type="assessment",
                    case_id=case.id,
                    case_code=getattr(case, "case_code", None),
                    session_id=session.id,
                    title=title,
                    subtitle=subtitle,
                    scheduled_at=schedule.start if schedule else None,
                    created_at=session.created_at,
                    status=session.status,
                    references=references_by_case.get(case.id, []),
                )
            )

        # 세션 없이 접수된 검사 케이스 (일정 없는 온라인 접수) — case 단위 target
        for case in assessment_cases:
            if case.id in cases_with_sessions:
                continue
            if case.id in billed_case_ids:
                continue

            title, subtitle = _format_assessment_labels(case)
            targets.append(
                BillableTarget(
                    type="assessment",
                    case_id=case.id,
                    case_code=getattr(case, "case_code", None),
                    session_id=None,
                    title=title,
                    subtitle=subtitle,
                    scheduled_at=None,
                    created_at=case.created_at,
                    status=case.status,
                    references=references_by_case.get(case.id, []),
                )
            )

    # 상담
    counseling_case_facade = CounselingCaseFacade(uow)
    counseling_session_facade = CounselingSessionFacade(uow)
    program_facade = ProgramFacade(uow)  # noqa: F841 아래에서 get_programs_by_ids 호출

    counseling_case_ids = await counseling_case_facade.list_case_ids_by_participant_ids(
        participant_ids=[client_id],
        center_id=center_id,
    )
    if counseling_case_ids:
        cases = await counseling_case_facade.get_cases_by_ids(counseling_case_ids)
        cases = [c for c in cases if c.center_id == center_id]
        c_case_by_id = {c.id: c for c in cases}

        if cases:
            c_sessions = await counseling_session_facade.get_sessions_by_case_ids(
                [c.id for c in cases]
            )
            c_sessions = [s for s in c_sessions if s.status != "cancelled"]

            # 청구는 session 또는 case 단위로 묶일 수 있어 두 related_type 모두 확인
            billed_ids_c: set[str] = set()
            if not include_billed:
                for rt in ("counseling_session", "counseling_case"):
                    billed_ids_c |= await billable_facade.list_billed_session_ids(
                        center_id=center_id,
                        client_id=client_id,
                        related_type=rt,
                    )

            schedule_ids_c = [s.schedule_id for s in c_sessions if s.schedule_id]
            schedules_c = await schedule_facade.list_schedules_by_ids(schedule_ids_c)
            schedule_map_c = {sch.id: sch for sch in schedules_c}

            program_ids = list({c.program_id for c in cases if c.program_id})
            program_map = await program_facade.get_programs_by_ids(program_ids)

            for session in c_sessions:
                if session.id in billed_ids_c:
                    continue
                case = c_case_by_id.get(session.counseling_case_id)
                if not case:
                    continue

                program = program_map.get(case.program_id) if case.program_id else None
                program_name = program.name if program else None

                schedule = (
                    schedule_map_c.get(session.schedule_id)
                    if session.schedule_id
                    else None
                )
                # 회차 번호는 과거 회기 추가 시 시간순 재정렬돼 발행된 청구서 문구와 어긋난다 — 날짜로 식별
                title = (
                    f"{schedule.start.month}/{schedule.start.day} 상담 회기"
                    if schedule
                    else "상담 회기"
                )
                refs: list[BillableTargetReference] = []
                if case.program_id:
                    refs.append(
                        BillableTargetReference(
                            reference_id=case.program_id,
                            label=program_name or "상담",
                            item_type="service",
                        )
                    )
                targets.append(
                    BillableTarget(
                        type="counseling",
                        case_id=case.id,
                        case_code=getattr(case, "case_code", None),
                        session_id=session.id,
                        title=title,
                        subtitle=program_name,
                        scheduled_at=schedule.start if schedule else None,
                        created_at=session.created_at,
                        status=session.status,
                        references=refs,
                    )
                )

    # 정렬: scheduled_at desc, null은 뒤 (created_at desc)
    targets.sort(
        key=lambda t: (
            t.scheduled_at is None,  # False(있음)가 먼저
            -(t.scheduled_at.timestamp() if t.scheduled_at else 0),
            -t.created_at.timestamp(),
        )
    )

    # 카운트 (필터 전 전체 기준)
    counts = BillableTargetCounts(
        all=len(targets),
        assessment=sum(1 for t in targets if t.type == "assessment"),
        counseling=sum(1 for t in targets if t.type == "counseling"),
    )

    # 타입 필터 적용
    if type_filter in ("assessment", "counseling"):
        filtered = [t for t in targets if t.type == type_filter]
    else:
        filtered = targets

    # 페이지네이션
    total = len(filtered)
    pages = math.ceil(total / size) if total > 0 else 0
    # page가 범위 밖이어도 빈 배열 반환 (에러 대신)
    safe_page = max(1, page)
    start = (safe_page - 1) * size
    end = start + size
    items = filtered[start:end]

    return BillableTargetListResponse(
        items=items,
        total_counts=counts,
        total=total,
        page=safe_page,
        size=size,
        pages=pages,
    )


async def _build_assessment_references(
    *,
    case,
    center_id: str,
    task_facade,
    set_facade,
) -> list[BillableTargetReference]:
    # 프론트 assessment-billing-service.ts의 matchPriceListItems와 동일 의미 (세트=package, 비-세트 task=service)
    refs: list[BillableTargetReference] = []

    set_summary = getattr(case, "set_summary", None)
    set_id: str | None = None
    set_name: str | None = None
    if set_summary:
        if isinstance(set_summary, dict):
            set_id = set_summary.get("set_id")
            set_name = set_summary.get("name")
        else:
            set_id = getattr(set_summary, "set_id", None)
            set_name = getattr(set_summary, "name", None)

    # 세트가 실제로 존재할 때만 refs에 추가 + set_assessment_ids 수집
    # (삭제된 세트는 제외하고 모든 task를 개별로 복원)
    set_assessment_ids: set[str] = set()
    if set_id:
        assessment_set = None
        try:
            assessment_set = await set_facade.get_set_with_response(
                center_id=center_id,
                set_id=set_id,
            )
        except EntityNotFoundException:
            assessment_set = None

        if assessment_set is not None:
            refs.append(
                BillableTargetReference(
                    reference_id=set_id,
                    label=assessment_set.name or set_name or "검사 세트",
                    item_type="package",
                )
            )
            set_assessment_ids = {a.id for a in assessment_set.assessment_summary}

    try:
        tasks = await task_facade.get_tasks_by_case_id(case.id)
    except Exception:
        tasks = []

    assessment_summary = getattr(case, "assessment_summary", None) or []
    name_by_id: dict[str, str] = {}
    for a in assessment_summary:
        if isinstance(a, dict):
            aid = a.get("id")
            kor = a.get("kor_name") or a.get("eng_name") or a.get("code")
        else:
            aid = getattr(a, "id", None)
            kor = (
                getattr(a, "kor_name", None)
                or getattr(a, "eng_name", None)
                or getattr(a, "code", None)
            )
        if aid:
            name_by_id[aid] = kor or "검사"

    for task in tasks:
        if task.assessment_id in set_assessment_ids:
            continue
        label = f"{name_by_id.get(task.assessment_id, '검사')} 검사"
        refs.append(
            BillableTargetReference(
                reference_id=task.assessment_id,
                label=label,
                item_type="service",
            )
        )

    return refs


def _format_assessment_labels(case) -> tuple[str, str | None]:
    set_summary = getattr(case, "set_summary", None)
    if set_summary:
        set_name = (
            set_summary.get("name")
            if isinstance(set_summary, dict)
            else getattr(set_summary, "name", None)
        )
        if set_name:
            return set_name, "검사 세트"

    assessment_summary = getattr(case, "assessment_summary", None) or []
    if assessment_summary:
        first = assessment_summary[0]
        first_name = None
        if isinstance(first, dict):
            first_name = (
                first.get("kor_name") or first.get("eng_name") or first.get("code")
            )
        else:
            first_name = (
                getattr(first, "kor_name", None)
                or getattr(first, "eng_name", None)
                or getattr(first, "code", None)
            )
        first_name = first_name or "검사"
        remaining = len(assessment_summary) - 1
        subtitle = f"외 {remaining}개" if remaining > 0 else None
        return first_name, subtitle

    return "검사", None


TOOL = {
    "name": "list_billable_targets_by_client_handler",
    "permission": "read:billing",
    "purpose": "특정 내담자에 대해 아직 청구되지 않은 상담·검사 세션을 청구 대상으로 모아 페이지 단위로 조회한다.",
    "keywords": [
        "list billable targets by client",
        "청구 대상",
        "미청구 세션",
        "청구할 것",
        "내담자 청구 목록",
        "청구 안 한 세션",
        "정산 대상",
        "청구 거리 찾기",
        "고객별 미청구",
    ],
    "boundaries": "'한 내담자'의 미청구(또는 포함 옵션 시 청구 포함) 상담/검사 세션을 청구 후보로 나열하는 읽기 전용 도구다. 센터 전체에서 오늘까지 누락된 청구를 보려면 list_missing_billables_until_today_handler를 쓴다. 이미 만들어진 청구서 목록을 보려면 list_billables_handler, 특정 케이스의 청구서 채움 항목을 보려면 build_billable_prefill_for_case_handler를 쓴다. 청구서를 만들지는 않는다(create_billable_handler가 그 역할).",
    "output": "내담자별 미청구 세션(청구 대상) 목록 (BillableTargetListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "청구 대상을 조회할 내담자의 UUID.",
            },
            "type_filter": {
                "type": "string",
                "title": "종류 필터",
                "enum": ["assessment", "counseling"],
                "description": "대상 종류 필터(선택, 없으면 전체).",
            },
            "include_billed": {
                "type": "boolean",
                "title": "청구 포함",
                "description": "이미 청구된 세션도 포함할지(기본 false=미청구만).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "minimum": 1,
                "maximum": 100,
                "description": "한 페이지 항목 수(1~100).",
            },
        },
        "required": ["client_id"],
    },
}
