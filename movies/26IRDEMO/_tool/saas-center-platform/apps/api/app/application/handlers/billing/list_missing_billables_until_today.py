from datetime import datetime, time as dt_time

from app.application.schemas import (
    BillableTarget,
    BillableTargetReference,
)
from app.core.datetime_utils import KST, to_utc_naive, utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork


async def list_missing_billables_until_today_handler(
    *,
    center_id: str,
    uow: UnitOfWork,
) -> list[BillableTarget]:
    # Lazy import — 순환 참조 방지
    from app.modules.assessment.facade import (
        AssessmentCaseFacade,
        AssessmentSessionFacade,
        AssessmentSetFacade,
        AssessmentTaskFacade,
    )
    from app.modules.center.facade import ProgramFacade
    from app.modules.counseling.facade import (
        CounselingCaseFacade,
        CounselingSessionFacade,
    )
    from app.modules.schedule.facade import ScheduleFacade

    # KST 기준 "오늘 끝(23:59:59.999999)"을 UTC naive로 변환.
    # 스케줄은 UTC naive 저장이므로 맞춰서 비교.
    # (단순 now_utc + 1day로 잡으면 내일 아침 일정까지 딸려 들어옴)
    now_kst = datetime.now(KST)
    end_of_today_kst = datetime.combine(now_kst.date(), dt_time.max, tzinfo=KST)
    end_of_today = to_utc_naive(end_of_today_kst)
    # 시작은 과거 전체 (epoch) — 오늘까지 누적
    far_past = datetime(2000, 1, 1)

    schedule_facade = ScheduleFacade(uow)
    schedules = await schedule_facade.list_schedules(
        center_id=center_id,
        start=far_past,
        end=end_of_today,
        schedule_types=["counseling", "assessment"],
    )
    if not schedules:
        return []

    schedule_by_id = {s.id: s for s in schedules}

    # 세션 조회 (상담/검사 각각)
    counseling_schedule_ids = [
        s.id for s in schedules if s.schedule_type == "counseling"
    ]
    assessment_schedule_ids = [
        s.id for s in schedules if s.schedule_type == "assessment"
    ]

    c_session_facade = CounselingSessionFacade(uow) if counseling_schedule_ids else None
    a_session_facade = AssessmentSessionFacade(uow) if assessment_schedule_ids else None

    # 진행 여부가 확정된 회기만 청구 대상 — 시간이 지났어도 아직 정리되지 않은
    # 예약(scheduled)은 제외한다(그건 미처리 시그널의 몫). 노쇼는 과금 여부가
    # 센터 정책이라 대상에 남기고, 청구할지는 사용자가 고른다.
    _SETTLED_COUNSELING = ("completed", "no_show")
    _SETTLED_ASSESSMENT = ("attended", "no_show")

    c_sessions = []
    if c_session_facade:
        c_sessions = await c_session_facade.get_sessions_by_schedule_ids(
            counseling_schedule_ids
        )
        c_sessions = [s for s in c_sessions if s.status in _SETTLED_COUNSELING]

    a_sessions = []
    if a_session_facade:
        a_sessions = await a_session_facade.get_sessions_by_schedule_ids(
            assessment_schedule_ids
        )
        a_sessions = [s for s in a_sessions if s.status in _SETTLED_ASSESSMENT]

    # 청구 커버리지 조회 (좁은 범위)
    # 오늘까지의 세션/케이스에 해당하는 청구 항목만 스캔
    # (센터 전체 스캔 방지 — 청구 누적량과 무관하게 일정 응답 시간)
    c_session_ids = {s.session_id for s in c_sessions if s.session_id}
    a_session_ids = {s.session_id for s in a_sessions if s.session_id}
    c_case_ids = {s.case_id for s in c_sessions if s.case_id}
    a_case_ids = {s.case_id for s in a_sessions if s.case_id}

    # 세션 단위 청구는 (session_id, client_id) 쌍으로 추적 — 그룹 세션 지원
    from app.modules.billing.facade import BillableFacade

    coverage = await BillableFacade(uow).get_billing_coverage(
        center_id=center_id,
        counseling_session_ids=c_session_ids,
        assessment_session_ids=a_session_ids,
        counseling_case_ids=c_case_ids,
        assessment_case_ids=a_case_ids,
    )
    covered_session_client_pairs = coverage["session_client_pairs"]
    covered_case_ids_counseling = coverage["case_ids_counseling"]
    covered_case_ids_assessment = coverage["case_ids_assessment"]

    targets: list[BillableTarget] = []

    # 상담
    if c_sessions:
        program_facade = ProgramFacade(uow)

        case_ids_c = list({s.case_id for s in c_sessions})
        cases_c = []
        if case_ids_c:
            cases_c = await CounselingCaseFacade(uow).get_cases_by_ids(case_ids_c)
            cases_c = [c for c in cases_c if c.center_id == center_id]
        c_case_by_id = {c.id: c for c in cases_c}

        program_ids = list({c.program_id for c in cases_c if c.program_id})
        program_map = (
            await program_facade.get_programs_by_ids(program_ids) if program_ids else {}
        )

        # counseling의 participant_id == client_id (client_participants[].participant_id가 곧 내담자)
        # 이름만 뽑아 버리지 않고 객체를 들고 있는다 — 행 표기(생년월일|성별·프로필)가 같은 조회에서 나온다
        client_by_id: dict[str, object] = {}
        all_client_ids_c: set[str] = set()
        for sess in c_sessions:
            for cp in getattr(sess, "client_participants", []) or []:
                pid = (
                    cp.get("participant_id")
                    if isinstance(cp, dict)
                    else getattr(cp, "participant_id", None)
                )
                if pid:
                    all_client_ids_c.add(pid)
        if all_client_ids_c:
            try:
                from app.modules.client.facade import ClientFacade

                client_facade = ClientFacade(uow)
                clients_map = await client_facade.get_clients_by_ids(
                    list(all_client_ids_c)
                )
                client_by_id.update(clients_map)
            except Exception:
                # 내담자 조회 실패해도 진행
                pass

        for sess in c_sessions:
            # 케이스 패키지 청구는 케이스 전체 커버 (참여자 모두 제외)
            if sess.case_id in covered_case_ids_counseling:
                continue

            case = c_case_by_id.get(sess.case_id)
            if not case:
                continue

            program = program_map.get(case.program_id) if case.program_id else None
            program_name = program.name if program else None

            schedule = (
                schedule_by_id.get(sess.schedule_id) if sess.schedule_id else None
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

            # 참여 내담자별로 row 펼치기 (그룹 세션 지원)
            # 청구된 (session_id, client_id) 쌍은 제외
            client_participants = getattr(sess, "client_participants", []) or []
            for cp in client_participants:
                participant_client_id = (
                    cp.get("participant_id")
                    if isinstance(cp, dict)
                    else getattr(cp, "participant_id", None)
                )
                if not participant_client_id:
                    continue
                if (
                    sess.session_id,
                    participant_client_id,
                ) in covered_session_client_pairs:
                    continue

                client = client_by_id.get(participant_client_id)
                targets.append(
                    BillableTarget(
                        type="counseling",
                        case_id=case.id,
                        case_code=getattr(case, "case_code", None),
                        session_id=sess.session_id,
                        client_id=participant_client_id,
                        client_name=getattr(client, "name", None),
                        client_birth_date=getattr(client, "birth_date", None),
                        client_gender=getattr(client, "gender", None),
                        client_profile_image_url=getattr(
                            client, "profile_image_url", None
                        ),
                        title=title,
                        subtitle=program_name,
                        scheduled_at=schedule.start if schedule else None,
                        # DTO에 created_at 없음 — schedule.start 또는 now로 대체
                        created_at=schedule.start if schedule else utc_now(),
                        status=sess.status,
                        references=refs,
                    )
                )

    # 검사
    if a_sessions:
        a_task_facade = AssessmentTaskFacade(uow)
        a_set_facade = AssessmentSetFacade(uow)

        case_ids_a = list({s.case_id for s in a_sessions})
        cases_a = []
        if case_ids_a:
            cases_a = await AssessmentCaseFacade(uow).get_cases_by_ids(case_ids_a)
            cases_a = [c for c in cases_a if c.center_id == center_id]
        a_case_by_id = {c.id: c for c in cases_a}

        from app.application.handlers.billing.list_billable_targets_by_client import (
            _build_assessment_references,
            _format_assessment_labels,
        )

        references_by_case: dict[str, list[BillableTargetReference]] = {}
        for case in cases_a:
            references_by_case[case.id] = await _build_assessment_references(
                case=case,
                center_id=center_id,
                task_facade=a_task_facade,
                set_facade=a_set_facade,
            )

        client_by_id_a: dict[str, object] = {}
        all_client_ids_a: set[str] = set()
        for sess in a_sessions:
            for cp in getattr(sess, "client_participants", []) or []:
                pid = (
                    cp.get("participant_id")
                    if isinstance(cp, dict)
                    else getattr(cp, "participant_id", None)
                )
                if pid:
                    all_client_ids_a.add(pid)
        if all_client_ids_a:
            try:
                from app.modules.client.facade import ClientFacade

                client_facade = ClientFacade(uow)
                clients_map = await client_facade.get_clients_by_ids(
                    list(all_client_ids_a)
                )
                client_by_id_a.update(clients_map)
            except Exception:
                pass

        for sess in a_sessions:
            # 케이스 패키지 청구는 케이스 전체 커버
            if sess.case_id in covered_case_ids_assessment:
                continue

            case = a_case_by_id.get(sess.case_id)
            if not case:
                continue

            title, subtitle = _format_assessment_labels(case)

            schedule = (
                schedule_by_id.get(sess.schedule_id) if sess.schedule_id else None
            )

            # 참여 내담자별로 row 펼치기
            client_participants = getattr(sess, "client_participants", []) or []
            for cp in client_participants:
                participant_client_id = (
                    cp.get("participant_id")
                    if isinstance(cp, dict)
                    else getattr(cp, "participant_id", None)
                )
                if not participant_client_id:
                    continue
                if (
                    sess.session_id,
                    participant_client_id,
                ) in covered_session_client_pairs:
                    continue

                client = client_by_id_a.get(participant_client_id)
                targets.append(
                    BillableTarget(
                        type="assessment",
                        case_id=case.id,
                        case_code=getattr(case, "case_code", None),
                        session_id=sess.session_id,
                        client_id=participant_client_id,
                        client_name=getattr(client, "name", None),
                        client_birth_date=getattr(client, "birth_date", None),
                        client_gender=getattr(client, "gender", None),
                        client_profile_image_url=getattr(
                            client, "profile_image_url", None
                        ),
                        title=title,
                        subtitle=subtitle,
                        scheduled_at=schedule.start if schedule else None,
                        created_at=schedule.start if schedule else utc_now(),
                        status=sess.status,
                        references=references_by_case.get(case.id, []),
                    )
                )

    # 정렬: scheduled_at 최신순 (None은 뒤)
    targets.sort(
        key=lambda t: (
            t.scheduled_at is None,
            -(t.scheduled_at.timestamp() if t.scheduled_at else 0),
            -t.created_at.timestamp(),
        )
    )

    return targets


TOOL = {
    "name": "list_missing_billables_until_today_handler",
    "permission": "read:billing",
    "purpose": "오늘까지 발생했어야 하는데 아직 생성되지 않은 청구 대상을 조회한다.",
    "keywords": [
        "list missing billables until today",
        "누락 청구",
        "미생성 청구",
        "청구 누락 점검",
        "빠진 청구",
        "미청구 대상",
        "오늘까지 청구",
    ],
    "boundaries": "오늘 기준 '누락된' 청구 대상만 찾아주는 점검용 읽기 도구다. 실제 청구 목록은 list_billables_handler.",
    "output": "오늘까지 누락된 청구 대상 목록 (BillableTarget 배열).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
