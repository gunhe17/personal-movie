from datetime import date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.application.schemas import (
    AssessmentCaseListItem,
    AssessmentCaseListResponse,
    ClientSummaryForCase,
    AssessmentSummaryForCase,
)
from app.modules.assessment.facade import (
    AssessmentFacade,
    AssessmentCaseFacade,
    AssessmentCaseParticipantFacade,
    AssessmentSessionFacade,
    AssessmentTaskFacade,
)
from app.modules.client.facade import ClientFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.center.facade import MemberFacade, RoomFacade
from app.modules.person.facade import PersonFacade
from app.modules.billing.facade import BillableFacade


def calculate_age(birth_date: date | None) -> int | None:
    if not birth_date:
        return None

    today = date.today()
    age = today.year - birth_date.year

    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1

    return age


async def list_cases_handler(
    center_id: str,
    counselor_id: str | None,
    status: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
    search: str | None = None,
    sort_order: str = "desc",
    case_type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    has_schedule: bool | None = None,
    owner_scope: str | None = None,
) -> AssessmentCaseListResponse:
    assessment_facade = AssessmentFacade(uow)
    case_facade = AssessmentCaseFacade(uow)
    participant_facade = AssessmentCaseParticipantFacade(uow)
    session_facade = AssessmentSessionFacade(uow)
    client_facade = ClientFacade(uow)
    member_facade = MemberFacade(uow)
    person_facade = PersonFacade(uow)
    schedule_facade = ScheduleFacade(uow)
    room_facade = RoomFacade(uow)
    task_facade = AssessmentTaskFacade(uow)

    has_institution: bool | None = None
    if case_type == "group":
        has_institution = True
    elif case_type == "individual":
        has_institution = False

    # 이름 검색: Client 이름으로 case_ids를 먼저 좁힌다 (크로스 모듈)
    case_ids_filter: list[str] | None = None
    if search:
        client_ids = await client_facade.list_client_ids_by_name(center_id, search)
        if client_ids:
            case_ids_filter = await participant_facade.list_case_ids_by_client_ids(
                center_id, client_ids
            )

    # owner_scope(access_level=own)면 열람 범위(주담당+참여 검사자)와 교집합
    if owner_scope is not None:
        accessible_case_ids = await case_facade.list_accessible_case_ids(
            center_id, owner_scope
        )
        if not accessible_case_ids:
            return AssessmentCaseListResponse(
                items=[], total=0, page=page, size=size, pages=0
            )
        case_ids_filter = (
            list(set(case_ids_filter) & set(accessible_case_ids))
            if case_ids_filter is not None
            else accessible_case_ids
        )
        if not case_ids_filter:
            return AssessmentCaseListResponse(
                items=[], total=0, page=page, size=size, pages=0
            )

    cases, page_meta = await case_facade.list_cases(
        center_id,
        status=status,
        counselor_id=counselor_id,
        search=search,
        sort_order=sort_order,
        has_institution=has_institution,
        date_from=date_from,
        date_to=date_to,
        case_ids_filter=case_ids_filter,
        has_schedule=has_schedule,
        page=page,
        size=size,
    )
    total = page_meta["total"]

    if not cases:
        return AssessmentCaseListResponse(
            items=[], total=0, page=page, size=size, pages=0
        )

    case_ids = [c.id for c in cases]

    all_assessment_ids = set()
    for case in cases:
        for assessment_summary in case.assessment_summary:
            all_assessment_ids.add(assessment_summary["id"])

    assessments = await assessment_facade.get_assessments_by_ids(
        list(all_assessment_ids)
    )
    assessment_map = {a.id: a for a in assessments}

    participants = await participant_facade.get_participants_by_case_ids(case_ids)

    case_to_client_ids: dict[str, list[str]] = {cid: [] for cid in case_ids}
    for p in participants:
        if p.participant_type == "client" and p.unassigned_at is None:
            case_to_client_ids[p.case_id].append(p.participant_id)

    all_client_ids = []
    for client_ids in case_to_client_ids.values():
        all_client_ids.extend(client_ids)

    clients = await client_facade.list_clients_by_ids(all_client_ids)
    client_map = {c.id: c for c in clients}

    counselor_ids = list(set(c.counselor_id for c in cases))
    member_map = await member_facade.get_members_by_ids(counselor_ids)
    person_ids = [m.person_id for m in member_map.values()]
    person_map = await person_facade.get_persons_by_ids(person_ids)

    sessions = await session_facade.get_sessions_by_case_ids(case_ids)

    # Case별 예약일은 첫 번째 Session의 schedule_id 기준
    case_to_schedule_id: dict[str, str | None] = {}
    for session in sessions:
        if session.case_id not in case_to_schedule_id and session.schedule_id:
            case_to_schedule_id[session.case_id] = session.schedule_id

    schedule_ids = [sid for sid in case_to_schedule_id.values() if sid]
    schedule_map = {}
    room_map = {}
    if schedule_ids:
        schedules = await schedule_facade.list_schedules_by_ids(schedule_ids)
        schedule_map = {s.id: s for s in schedules}
        room_ids = list({s.room_id for s in schedules if s.room_id})
        if room_ids:
            room_map = await room_facade.get_rooms_by_ids(room_ids)

    progress_map = await task_facade.get_task_progress_for_cases(case_ids)

    # 미청구 회기 여부 계산 — client_id별 청구 완료 집합을 캐시해 N+1 방지
    sessions_by_case: dict[str, list] = {}
    for session in sessions:
        sessions_by_case.setdefault(session.case_id, []).append(session)

    billable_facade = BillableFacade(uow)
    billed_sessions_cache: dict[str, set[str]] = {}
    billed_cases_cache: dict[str, set[str]] = {}

    async def _billed_sessions(cid: str) -> set[str]:
        if cid not in billed_sessions_cache:
            billed_sessions_cache[cid] = await billable_facade.list_billed_session_ids(
                center_id=center_id,
                client_id=cid,
                related_type="assessment_session",
            )
        return billed_sessions_cache[cid]

    async def _billed_cases(cid: str) -> set[str]:
        if cid not in billed_cases_cache:
            billed_cases_cache[cid] = await billable_facade.list_billed_case_ids(
                center_id=center_id,
                client_id=cid,
                related_type="assessment_case",
            )
        return billed_cases_cache[cid]

    has_uninvoiced_by_case: dict[str, bool] = {}
    for case in cases:
        case_client_ids = case_to_client_ids.get(case.id, [])
        # 취소되지 않은 회기 (청구 대상)
        billable_sessions = [
            s for s in sessions_by_case.get(case.id, []) if s.status != "cancelled"
        ]
        uninvoiced = False
        for cid in case_client_ids:
            # 케이스 패키지로 이미 청구됐으면 이 내담자는 미청구 아님
            if case.id in await _billed_cases(cid):
                continue
            if billable_sessions:
                # 일정(세션)이 있는 검사: 미청구 회기가 하나라도 있으면 미청구
                billed = await _billed_sessions(cid)
                if any(s.id not in billed for s in billable_sessions):
                    uninvoiced = True
                    break
            else:
                # 일정 없는 검사: 세션이 없어 케이스 단위 청구만 가능
                # → 위에서 케이스 청구가 확인되지 않았으므로 미청구
                uninvoiced = True
                break
        has_uninvoiced_by_case[case.id] = uninvoiced

    pages = page_meta["pages"]
    items = []

    for case in cases:
        client_summaries = []
        for client_id in case_to_client_ids[case.id]:
            client = client_map.get(client_id)
            if not client:
                continue

            client_summaries.append(
                ClientSummaryForCase(
                    client_id=client.id,
                    name=client.name,
                    client_code=client.code,
                    birth_date=client.birth_date,
                    age=calculate_age(client.birth_date),
                    gender=client.gender,
                    profile_image_url=client.profile_image_url,
                )
            )

        assessment_summaries = []
        for summary in case.assessment_summary:
            assessment = assessment_map.get(summary["id"])
            if not assessment:
                continue  # Assessment가 삭제된 경우 스킵

            assessment_summaries.append(
                AssessmentSummaryForCase(
                    id=assessment.id,
                    code=assessment.code,
                    kor_name=assessment.kor_name,
                    eng_name=assessment.eng_name,
                    assessment_type=assessment.assessment_type,
                    duration=assessment.duration,
                )
            )

        # 검사명 목록 (하위 호환성 유지)
        assessment_names = [a.kor_name for a in assessment_summaries]

        schedule_id = case_to_schedule_id.get(case.id)
        scheduled_start = None
        scheduled_end = None
        room_id = None
        room_name = None
        if schedule_id:
            schedule = schedule_map.get(schedule_id)
            if schedule:
                scheduled_start = schedule.start
                scheduled_end = schedule.end
                room_id = schedule.room_id
                if room_id:
                    room = room_map.get(room_id)
                    if room:
                        room_name = room.name

        case_type = "group" if case.institution_summary else "individual"
        institution_name = (
            case.institution_summary.get("name") if case.institution_summary else None
        )

        member = member_map.get(case.counselor_id)
        person = person_map.get(member.person_id) if member else None
        counselor_name = person.name if person else None

        set_name = case.set_summary.get("name") if case.set_summary else None

        progress = progress_map.get(case.id)
        completed_count = progress.completed_count if progress else 0
        total_count_val = progress.total_count if progress else 0

        # 종합보고서: 필요 여부 + 작성 완료 여부(documents 존재)
        is_final_report_required = bool(case.is_final_report_required)
        has_comprehensive_report = is_final_report_required and bool(case.documents)

        items.append(
            AssessmentCaseListItem(
                case_id=case.id,
                case_code=case.case_code,
                status=case.status,
                case_type=case_type,
                created_at=case.created_at,
                counselor_id=case.counselor_id,
                counselor_name=counselor_name,
                clients=client_summaries,
                assessments=assessment_summaries,
                assessment_names=assessment_names,
                institution_name=institution_name,
                set_name=set_name,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                room_id=room_id,
                room_name=room_name,
                completed_count=completed_count,
                total_count=total_count_val,
                is_final_report_required=is_final_report_required,
                has_comprehensive_report=has_comprehensive_report,
                has_uninvoiced_sessions=has_uninvoiced_by_case.get(case.id, False),
            )
        )

    return AssessmentCaseListResponse(
        items=items, total=total, page=page, size=size, pages=pages
    )


TOOL = {
    "name": "list_cases_handler",
    "agent_exposed": False,
    "permission": "read:assessment_case",
    "purpose": "검사 케이스 목록을 담당자·상태·검색어·기간으로 거르고 페이지 단위로 조회한다.",
    "keywords": [
        "list cases",
        "검사 목록",
        "검사 케이스 목록",
        "평가 목록",
        "검사 조회",
        "케이스 리스트",
        "검사 검색",
    ],
    "boundaries": "여러 검사 케이스를 목록으로 조회(읽기 전용). 단건 상세는 get_case_handler, 특정 내담자 이력은 list_cases_by_client_handler.",
    "output": "검사 케이스 목록 (AssessmentCaseListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "counselor_id": {
                "type": "string",
                "format": "uuid",
                "title": "상담사 필터",
                "description": "담당 상담사로 한정(선택).",
            },
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "케이스 상태 필터(선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "내담자명 등 검색어(선택).",
            },
            "case_type": {
                "type": "string",
                "title": "검사 유형 필터",
                "description": "검사 유형 필터(선택).",
            },
            "date_from": {
                "type": "string",
                "format": "date",
                "title": "시작일",
                "description": "조회 시작일(선택).",
            },
            "date_to": {
                "type": "string",
                "format": "date",
                "title": "종료일",
                "description": "조회 종료일(선택).",
            },
            "has_schedule": {
                "type": "boolean",
                "title": "일정 유무 필터",
                "description": "일정 유무 필터(선택).",
            },
            "sort_order": {
                "type": "string",
                "title": "정렬",
                "description": "정렬 방향(asc|desc, 기본 desc).",
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
                "description": "페이지당 개수.",
            },
        },
        "required": ["page", "size"],
    },
}
