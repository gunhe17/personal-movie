from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.application.schemas import (
    UnprocessedSessionItem,
    UnprocessedSessionListResponse,
)
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.center.facade import ProgramFacade, MemberFacade, RoomFacade
from app.modules.person.facade import PersonFacade
from app.modules.client.facade import ClientFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.counseling.counseling_case_participant.schemas import (
    CaseParticipantType,
)

# 판정이 훑는 케이스 상한 — 절삭 전 전체 대상이 필요해서 목록 size와 별개
_SCAN_CAP = 2000


async def list_unprocessed_counseling_sessions_handler(
    center_id: str,
    owner_scope: str | None,
    size: int,
    uow: UnitOfWork,
) -> UnprocessedSessionListResponse:
    # 미처리 회기 = 진행 중 케이스의 예약(scheduled) 회기인데 일정 시작이 이미 지난 것.
    # 케이스 단위 unprocessed 시그널(list_counseling_cases_enriched)의 회기 단위 판이며,
    # 대시보드가 이 응답으로 목록과 건수를 함께 읽는다.
    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    # 시그널은 행동 큐 — 완료 처리는 주담당 전용이라 부담당(읽기 전용) 케이스는 세지 않는다
    cases, _ = await case_facade.list_cases(
        center_id=center_id,
        status="active",
        counselor_id=owner_scope,
        offset=0,
        limit=_SCAN_CAP,
    )
    if not cases:
        return UnprocessedSessionListResponse(items=[], total=0)

    case_map = {c.id: c for c in cases}
    sessions = await session_facade.get_sessions_by_case_ids(list(case_map))
    scheduled = [s for s in sessions if s.status == "scheduled" and s.schedule_id]
    if not scheduled:
        return UnprocessedSessionListResponse(items=[], total=0)

    schedules = await schedule_facade.list_schedules_by_ids(
        [s.schedule_id for s in scheduled]
    )
    schedule_map = {s.id: s for s in schedules}

    now = utc_now()
    overdue = [
        (session, schedule)
        for session in scheduled
        if (schedule := schedule_map.get(session.schedule_id))
        and schedule.start < now
    ]
    if not overdue:
        return UnprocessedSessionListResponse(items=[], total=0)

    # 최근에 지난 회기부터 — 기억이 선명한 순서가 곧 처리하기 쉬운 순서
    overdue.sort(key=lambda pair: pair[1].start, reverse=True)
    total = len(overdue)
    overdue = overdue[:size]

    page_case_ids = list({session.counseling_case_id for session, _ in overdue})
    page_cases = [case_map[cid] for cid in page_case_ids]

    program_map = await ProgramFacade(uow).get_programs_by_ids(
        list({c.program_id for c in page_cases})
    )

    participants_map = await case_facade.get_participants_by_case_ids(
        page_case_ids, center_id
    )
    client_ids = [
        p.participant_id
        for participants in participants_map.values()
        for p in participants
        if p.participant_type == CaseParticipantType.CLIENT.value and p.is_active
    ]
    clients = (
        await ClientFacade(uow).list_clients_by_ids(client_ids) if client_ids else []
    )
    client_map = {c.id: c for c in clients}

    # facade-to-facade 금지: MemberFacade(member) + PersonFacade(이름) 조합을 handler 본문이 수행
    counselor_ids = list({c.counselor_id for c in page_cases if c.counselor_id})
    member_map = (
        await MemberFacade(uow).get_members_by_ids(counselor_ids)
        if counselor_ids
        else {}
    )
    person_map = (
        await PersonFacade(uow).get_persons_by_ids(
            [m.person_id for m in member_map.values()]
        )
        if member_map
        else {}
    )
    counselor_name_map = {
        member_id: (person.name if (person := person_map.get(member.person_id)) else None)
        for member_id, member in member_map.items()
    }

    room_map = await RoomFacade(uow).get_rooms_by_ids(
        list({s.room_id for _, s in overdue if s.room_id})
    )

    items = []
    for session, schedule in overdue:
        case = case_map[session.counseling_case_id]
        program = program_map.get(case.program_id)
        room = room_map.get(schedule.room_id) if schedule.room_id else None
        client_names = [
            client.name
            for p in participants_map.get(case.id, [])
            if p.participant_type == CaseParticipantType.CLIENT.value
            and p.is_active
            and (client := client_map.get(p.participant_id))
        ]
        items.append(
            UnprocessedSessionItem(
                session_id=session.id,
                case_id=case.id,
                case_code=case.case_code,
                session_number=session.session_number,
                program_name=program.name if program else None,
                client_names=client_names,
                counselor_name=counselor_name_map.get(case.counselor_id),
                start=schedule.start,
                end=schedule.end,
                room_name=room.name if room else None,
            )
        )

    return UnprocessedSessionListResponse(items=items, total=total)


TOOL = {
    "name": "list_unprocessed_counseling_sessions_handler",
    "permission": "read:counseling",
    "purpose": "예약 시간이 지났는데 완료·취소로 정리되지 않은 상담 회기를 찾는다.",
    "keywords": [
        "미처리 회기",
        "지난 회기",
        "정리 안 된 회기",
        "unprocessed session",
    ],
    "boundaries": "진행 중 케이스의 지난 예약 회기만(읽기). 회기 상태 변경은 update_counseling_session_handler, 케이스 단위 판정은 list_counseling_cases_enriched_handler(signal=unprocessed).",
    "output": "미처리 회기 목록과 전체 건수 (UnprocessedSessionListResponse). 최근에 지난 회기 순.",
    "input_schema": {
        "type": "object",
        "properties": {
            "size": {
                "type": "integer",
                "title": "목록 개수",
                "description": "반환할 회기 수. total은 절삭과 무관한 전체 건수.",
            },
        },
        "required": ["size"],
    },
}
