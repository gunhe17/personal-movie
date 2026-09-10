from datetime import date

from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.application.schemas import (
    CounselingCaseListItem,
    CounselingCaseListResponse,
    ClientSummaryForCase,
)
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.center.facade import ProgramFacade, MemberFacade, RoomFacade
from app.modules.person.facade import PersonFacade
from app.modules.client.facade import ClientFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.billing.facade import BillableFacade
from app.modules.counseling.counseling_case_participant.schemas import (
    CaseParticipantType,
)


async def _build_member_persons_map(
    uow: UnitOfWork,
    member_facade: MemberFacade,
    member_ids: list[str],
) -> dict[str, tuple[object, object | None]]:
    # facade-to-facade 금지: MemberFacade(member) + PersonFacade(이름) 조합을 handler 본문이 수행
    if not member_ids:
        return {}

    member_map = await member_facade.get_members_by_ids(member_ids)
    if not member_map:
        return {}

    person_map = await PersonFacade(uow).get_persons_by_ids(
        [m.person_id for m in member_map.values()]
    )
    return {
        member_id: (member, person_map.get(member.person_id))
        for member_id, member in member_map.items()
    }


# 시그널 사전 판정이 훑는 케이스 상한 — 필터·페이지네이션 전 전체 대상이 필요해서 별도 cap
_SIGNAL_SCAN_CAP = 2000


async def _filter_case_ids_by_signal(
    signal: str,
    cases: list,
    session_facade: CounselingSessionFacade,
    schedule_facade: ScheduleFacade,
) -> list[str]:
    # web computeNextSession(view-model)과 동일 판정 — 대시보드 시그널 정의의 서버판.
    # unprocessed: 예약 회기는 있으나 전부 지나 다음 회기가 없음(미처리)
    # needs_review: 예약 0 + 진행된 회기 있음(연장·종결 확인)
    case_ids = [c.id for c in cases]
    if not case_ids:
        return []

    sessions_list = await session_facade.get_sessions_by_case_ids(case_ids)

    schedule_ids = [s.schedule_id for s in sessions_list if s.schedule_id]
    schedules = (
        await schedule_facade.list_schedules_by_ids(schedule_ids)
        if schedule_ids
        else []
    )
    schedule_map = {s.id: s for s in schedules}

    occurred_session_ids: set[str] = set()
    if signal == "needs_review" and sessions_list:
        participants = await session_facade.get_participants_by_session_ids(
            [s.id for s in sessions_list]
        )
        occurred_session_ids = {
            p.session_id
            for p in participants
            if p.participant_type == "client" and p.attendance_status != "scheduled"
        }

    sessions_by_case: dict[str, list] = {}
    for s in sessions_list:
        sessions_by_case.setdefault(s.counseling_case_id, []).append(s)

    now = utc_now()
    matched: list[str] = []
    for case in cases:
        if case.status == "completed":
            continue
        case_sessions = sessions_by_case.get(case.id, [])
        valid_sessions = [
            s
            for s in case_sessions
            if not s.schedule_id or schedule_map.get(s.schedule_id)
        ]
        scheduled = [s for s in valid_sessions if s.status == "scheduled"]
        has_next = any(
            s.schedule_id
            and (sched := schedule_map.get(s.schedule_id))
            and sched.start >= now
            for s in scheduled
        )
        if signal == "unprocessed":
            if scheduled and not has_next:
                matched.append(case.id)
        elif signal == "needs_review":
            completed = sum(
                1
                for s in valid_sessions
                if s.status != "cancelled"
                and (
                    s.status in ("completed", "no_show")
                    or s.id in occurred_session_ids
                )
            )
            if not scheduled and completed > 0:
                matched.append(case.id)
    return matched


def _calculate_age(birth_date: date | None) -> int | None:
    if not birth_date:
        return None
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


async def list_counseling_cases_enriched_handler(
    center_id: str,
    counselor_id: str | None,
    status: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
    client_name: str | None = None,
    client_id: str | None = None,
    counseling_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort: str = "desc",
    signal: str | None = None,
    owner_scope: str | None = None,
) -> CounselingCaseListResponse:
    # counselor_id = 담당자 필터(관리자 드롭다운), owner_scope = access_level=own 열람 제한(주담당+공동 상담사)
    _empty = CounselingCaseListResponse(
        items=[], total=0, page=page, size=size, pages=0
    )

    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)
    program_facade = ProgramFacade(uow)
    member_facade = MemberFacade(uow)
    client_facade = ClientFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    # counseling_type → program_ids
    filter_program_ids: list[str] | None = None
    if counseling_type:
        type_map = {"individual": "INDIVIDUAL", "group": "GROUP"}
        program_type = type_map.get(counseling_type)
        if program_type:
            filter_program_ids = await program_facade.list_program_ids_by_type(
                center_id, program_type
            )
            if not filter_program_ids:
                return _empty

    # client_name → case_ids
    filter_case_ids: list[str] | None = None
    if client_name:
        client_ids_by_name = await client_facade.list_client_ids_by_name(
            center_id, client_name
        )
        if not client_ids_by_name:
            return _empty
        filter_case_ids = await case_facade.list_case_ids_by_participant_ids(
            client_ids_by_name, center_id
        )
        if not filter_case_ids:
            return _empty

    # client_id → case_ids (상세페이지 이력용, 이름검색 스킵)
    if client_id:
        cid_case_ids = await case_facade.list_case_ids_by_participant_ids(
            [client_id], center_id
        )
        if not cid_case_ids:
            return _empty
        if filter_case_ids is not None:
            filter_case_ids = list(set(filter_case_ids) & set(cid_case_ids))
            if not filter_case_ids:
                return _empty
        else:
            filter_case_ids = cid_case_ids

    # start_date/end_date → case_ids (세션 일정 기준)
    if start_date or end_date:
        schedule_ids = await schedule_facade.list_schedule_ids_by_date_range(
            center_id, "counseling", start_date, end_date
        )
        if not schedule_ids:
            return _empty
        date_case_ids = await session_facade.list_case_ids_by_schedule_ids(schedule_ids)
        if not date_case_ids:
            return _empty
        if filter_case_ids is not None:
            filter_case_ids = list(set(filter_case_ids) & set(date_case_ids))
            if not filter_case_ids:
                return _empty
        else:
            filter_case_ids = date_case_ids

    # owner_scope → case_ids: 앞선 필터들의 교집합으로 열람 범위를 마지막에 강제한다
    # (client_name 분기가 filter_case_ids를 덮어쓰므로 선행 대입은 안전하지 않다).
    if owner_scope is not None:
        if signal:
            # 시그널은 행동 큐 — 부담당(읽기 전용)은 처리할 수 없으므로 주담당 케이스만 센다.
            # 열람(시그널 없는 목록)은 아래 accessible 스코프로 부담당 케이스까지 포함.
            counselor_id = owner_scope
        else:
            accessible_case_ids = await case_facade.list_accessible_case_ids(
                center_id, owner_scope
            )
            if not accessible_case_ids:
                return _empty
            filter_case_ids = (
                list(set(filter_case_ids) & set(accessible_case_ids))
                if filter_case_ids is not None
                else accessible_case_ids
            )
            if not filter_case_ids:
                return _empty

    # signal → case_ids: 회기 파생 상태(예약·완료·다음 회기)는 페이지네이션 뒤에 계산되므로,
    # 대상 케이스 전체를 사전 판정해 case_ids로 좁힌 뒤 기존 파이프라인을 태운다.
    # 대시보드 카운트는 이 핸들러를 signal+size=1로 호출해 total을 읽는다(정의 SSOT).
    if signal:
        signal_cases, _ = await case_facade.list_cases(
            center_id=center_id,
            status=status,
            counselor_id=counselor_id,
            offset=0,
            limit=_SIGNAL_SCAN_CAP,
            program_ids=filter_program_ids,
            case_ids=filter_case_ids,
            start_date=None,
            end_date=None,
            sort=sort,
        )
        matched_case_ids = await _filter_case_ids_by_signal(
            signal, signal_cases, session_facade, schedule_facade
        )
        if not matched_case_ids:
            return _empty
        filter_case_ids = matched_case_ids

    cases, total = await case_facade.list_cases(
        center_id=center_id,
        status=status,
        counselor_id=counselor_id,
        offset=(page - 1) * size,
        limit=size,
        program_ids=filter_program_ids,
        case_ids=filter_case_ids,
        start_date=None,
        end_date=None,
        sort=sort,
    )

    if not cases:
        return _empty

    program_ids = list(set(case.program_id for case in cases))
    program_map = await program_facade.get_programs_by_ids(program_ids)

    case_ids = [case.id for case in cases]
    participants_map = await case_facade.get_participants_by_case_ids(
        case_ids, center_id
    )

    client_ids = []
    counselor_ids = []
    for case_id, participants in participants_map.items():
        for p in participants:
            if p.participant_type == CaseParticipantType.CLIENT.value and p.is_active:
                client_ids.append(p.participant_id)
            elif (
                p.participant_type == CaseParticipantType.COUNSELOR.value
                and p.is_active
            ):
                counselor_ids.append(p.participant_id)

    clients = await client_facade.list_clients_by_ids(client_ids) if client_ids else []
    client_map = {c.id: c for c in clients}

    # facade-to-facade 금지: handler가 member+person 조립
    member_persons_map = await _build_member_persons_map(
        uow, member_facade, counselor_ids
    )

    sessions_list = await session_facade.get_sessions_by_case_ids(case_ids)

    sessions_by_case: dict[str, list] = {}
    for session in sessions_list:
        if session.counseling_case_id not in sessions_by_case:
            sessions_by_case[session.counseling_case_id] = []
        sessions_by_case[session.counseling_case_id].append(session)

    # 진행(열린) 회기 = 내담자가 예정(scheduled)이 아닌 회기(참석·지각·불참·노쇼). 상담 상세와 동일 정의.
    session_participants = await session_facade.get_participants_by_session_ids(
        [s.id for s in sessions_list]
    )
    occurred_session_ids: set[str] = {
        p.session_id
        for p in session_participants
        if p.participant_type == "client" and p.attendance_status != "scheduled"
    }

    all_schedule_ids = [s.schedule_id for s in sessions_list if s.schedule_id]
    schedules = (
        await schedule_facade.list_schedules_by_ids(all_schedule_ids)
        if all_schedule_ids
        else []
    )
    schedule_map = {s.id: s for s in schedules}

    room_facade = RoomFacade(uow)
    room_ids = list({s.room_id for s in schedules if s.room_id})
    room_map = await room_facade.get_rooms_by_ids(room_ids) if room_ids else {}

    # client_id별 청구 완료 집합을 캐시해 N+1 방지
    billable_facade = BillableFacade(uow)
    billed_sessions_cache: dict[str, set[str]] = {}
    billed_cases_cache: dict[str, set[str]] = {}

    async def _billed_sessions(cid: str) -> set[str]:
        if cid not in billed_sessions_cache:
            billed_sessions_cache[cid] = await billable_facade.list_billed_session_ids(
                center_id=center_id,
                client_id=cid,
                related_type="counseling_session",
            )
        return billed_sessions_cache[cid]

    async def _billed_cases(cid: str) -> set[str]:
        if cid not in billed_cases_cache:
            billed_cases_cache[cid] = await billable_facade.list_billed_case_ids(
                center_id=center_id,
                client_id=cid,
                related_type="counseling_case",
            )
        return billed_cases_cache[cid]

    has_uninvoiced_by_case: dict[str, bool] = {}
    for case in cases:
        case_client_ids = [
            p.participant_id
            for p in participants_map.get(case.id, [])
            if p.participant_type == CaseParticipantType.CLIENT.value and p.is_active
        ]
        # 취소되지 않은 회기만 청구 대상
        billable_sessions = [
            s for s in sessions_by_case.get(case.id, []) if s.status != "cancelled"
        ]
        uninvoiced = False
        for cid in case_client_ids:
            # 케이스 패키지로 이미 청구됐으면 이 내담자는 미청구 아님
            if case.id in await _billed_cases(cid):
                continue
            billed = await _billed_sessions(cid)
            if any(s.id not in billed for s in billable_sessions):
                uninvoiced = True
                break
        has_uninvoiced_by_case[case.id] = uninvoiced

    now = utc_now()
    pages = (total + size - 1) // size
    items = []

    for case in cases:
        program = program_map.get(case.program_id)
        program_name = program.name if program else "Unknown"
        case_type_map = {
            "INDIVIDUAL": "individual",
            "GROUP": "group",
        }
        case_type = (
            case_type_map.get(program.program_type, "individual")
            if program
            else "individual"
        )

        participants = participants_map.get(case.id, [])

        case_client_ids = [
            p.participant_id
            for p in participants
            if p.participant_type == CaseParticipantType.CLIENT.value and p.is_active
        ]
        clients_data = [
            ClientSummaryForCase(
                client_id=client.id,
                name=client.name,
                client_code=client.code,
                birth_date=client.birth_date,
                age=_calculate_age(client.birth_date),
                gender=client.gender if client.gender else None,
                profile_image_url=getattr(client, "profile_image_url", None),
            )
            for client_id in case_client_ids
            if (client := client_map.get(client_id))
        ]

        # Counselor 정보 — 대표(case.counselor_id) 이름 + 전체 활성 상담사 수.
        # case.counselor_id 가 진짜 source of truth. 참여자 목록의 첫 번째(joined_at 순)
        # 를 쓰면 대표와 불일치가 날 수 있음 (상담 상세 페이지 버그와 동일 원인).
        active_counselors = [
            p
            for p in participants
            if p.participant_type == CaseParticipantType.COUNSELOR.value and p.is_active
        ]
        counselor_count = len(active_counselors)
        counselor_name = "Unknown"
        primary_cp = next(
            (p for p in active_counselors if p.participant_id == case.counselor_id),
            None,
        )
        if primary_cp is None and active_counselors:
            # 정합성 fallback: 대표가 active_counselors 에 없으면 첫 번째 사용
            primary_cp = active_counselors[0]
        if primary_cp:
            member, person = member_persons_map.get(
                primary_cp.participant_id, (None, None)
            )
            if person:
                counselor_name = person.name

        # 전체 활성 상담사 이름 (대표 먼저, 나머지 뒤) — 호버 드롭다운용
        counselor_names: list[str] = []
        for cp in active_counselors:
            _, cp_person = member_persons_map.get(cp.participant_id, (None, None))
            if cp_person:
                name = cp_person.name
                if cp.participant_id == case.counselor_id:
                    counselor_names.insert(0, name)
                else:
                    counselor_names.append(name)

        # Session 진행 상황 (스케줄이 삭제된 세션은 제외)
        case_sessions = sessions_by_case.get(case.id, [])
        valid_sessions = [
            s
            for s in case_sessions
            if not s.schedule_id or schedule_map.get(s.schedule_id)
        ]
        completed_sessions = sum(
            1
            for s in valid_sessions
            if s.status != "cancelled"
            and (s.status in ("completed", "no_show") or s.id in occurred_session_ids)
        )
        scheduled_sessions = sum(1 for s in valid_sessions if s.status == "scheduled")

        # 다음 회기: scheduled 세션 중 가장 빠른 미래 일정
        next_sched = None
        for s in case_sessions:
            if s.status == "scheduled" and s.schedule_id:
                sched = schedule_map.get(s.schedule_id)
                if sched and sched.start >= now:
                    if next_sched is None or sched.start < next_sched.start:
                        next_sched = sched
        next_start = next_sched.start if next_sched else None
        next_end = next_sched.end if next_sched else None
        next_room = (
            room_map.get(next_sched.room_id)
            if next_sched and next_sched.room_id
            else None
        )
        next_room_name = next_room.name if next_room else None

        # 대표 상담실: 첫 회기(가장 빠른 일정)의 상담실 — 상세 페이지와 동일 기준.
        # 다음 회기가 없는 케이스(완료 등)도 상담실을 표시하기 위함.
        scheduled_pairs = [
            (sched, s)
            for s in case_sessions
            if s.schedule_id and (sched := schedule_map.get(s.schedule_id))
        ]
        first_sched = (
            min(scheduled_pairs, key=lambda pair: pair[0].start)[0]
            if scheduled_pairs
            else None
        )
        first_room = (
            room_map.get(first_sched.room_id)
            if first_sched and first_sched.room_id
            else None
        )
        room_name = first_room.name if first_room else None

        items.append(
            CounselingCaseListItem(
                case_id=case.id,
                case_code=case.case_code,
                status=case.status,
                case_type=case_type,
                program_name=program_name,
                clients=clients_data,
                counselor_name=counselor_name,
                counselor_count=counselor_count,
                counselor_names=counselor_names,
                completed_sessions=completed_sessions,
                scheduled_sessions=scheduled_sessions,
                # 총회기는 케이스 계약값이 정본 — 회기 수 재계산으로 덮으면 편집값과 어긋난다
                total_sessions=case.total_sessions
                or sum(1 for s in valid_sessions if s.status != "cancelled"),
                next_session_start=next_start,
                next_session_end=next_end,
                next_session_room_name=next_room_name,
                room_name=room_name,
                has_uninvoiced_sessions=has_uninvoiced_by_case.get(case.id, False),
                created_at=case.created_at,
            )
        )

    return CounselingCaseListResponse(
        items=items, total=total, page=page, size=size, pages=pages
    )


TOOL = {
    "name": "list_counseling_cases_enriched_handler",
    "agent_exposed": False,
    "permission": "read:counseling",
    "purpose": "센터의 상담 케이스를 다양한 필터(상태·내담자·유형·기간)로 검색해 페이지 단위 목록으로 조회한다.",
    "keywords": [
        "list counseling cases",
        "케이스 목록",
        "상담 목록 조회",
        "케이스 검색",
        "상담 찾기",
        "내담자별 상담",
        "기간별 상담",
        "케이스 리스트",
        "상담 필터",
    ],
    "boundaries": "센터 전체 또는 권한 범위 내 상담 케이스를 조건 검색·페이지네이션하는 목록 도구다. 로그인한 상담사 '본인 담당' 케이스 + 통계 요약이 필요하면 list_my_counseling_cases_handler를, 케이스 단건의 상세가 필요하면 get_counseling_case_detail_handler를, 내 작성/미작성 노트 목록이 필요하면 list_my_counseling_notes_handler를 쓴다. counselor_id None이면 센터 전체, 값 있으면 본인 케이스만.",
    "output": "상담 케이스 목록 (CounselingCaseListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "케이스 상태(예: in_progress | completed | cancelled). 없으면 전체.",
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
                "description": "페이지당 케이스 수.",
            },
            "client_name": {
                "type": "string",
                "title": "내담자 이름 검색",
                "description": "내담자 이름 부분 일치 검색.",
            },
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "내담자 필터",
                "description": "특정 내담자의 케이스 이력만(이름 검색 건너뜀).",
            },
            "counseling_type": {
                "type": "string",
                "title": "상담 유형",
                "description": "individual(개인) 또는 group(집단).",
            },
            "start_date": {
                "type": "string",
                "format": "date",
                "title": "시작일",
                "description": "회기 일정 기준 검색 시작일(YYYY-MM-DD).",
            },
            "end_date": {
                "type": "string",
                "format": "date",
                "title": "종료일",
                "description": "회기 일정 기준 검색 종료일(YYYY-MM-DD).",
            },
            "sort": {
                "type": "string",
                "title": "정렬",
                "description": "desc(최신순) 또는 asc(오래된순).",
            },
            "signal": {
                "type": "string",
                "title": "시그널 필터",
                "description": "대시보드 시그널 필터 (unprocessed: 예약 회기가 전부 지나 미처리 | needs_review: 예약 0에 진행 회기가 있어 연장·종결 확인 필요). 선택.",
            },
        },
        "required": ["page", "size"],
    },
}
