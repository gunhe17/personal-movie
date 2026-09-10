from datetime import date, datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException
from app.application.schemas import (
    CounselingCaseDetailResponse,
    ClientSummaryForCase,
    SessionDetailInfo,
    SessionParticipantInfo,
    SessionCounselorInfo,
)
from app.modules.counseling.facade import (
    CounselingCaseFacade,
    CounselingSessionFacade,
    CounselingNoteFacade,
)
from app.modules.center.facade import ProgramFacade, MemberFacade, RoomFacade
from app.modules.person.facade import PersonFacade
from app.modules.client.facade import ClientFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.counseling.counseling_case_participant.schemas import (
    CaseParticipantType,
)
from app.modules.counseling.counseling_session_participant.schemas import (
    ParticipantType,
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


def _calculate_age(birth_date: date | None) -> int | None:
    if not birth_date:
        return None
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


async def get_counseling_case_detail_handler(
    case_id: str,
    center_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
    actor_membership_id: str | None = None,
) -> CounselingCaseDetailResponse:
    # owner_scope None=access_level=all(센터 전체), 값 있음=주담당+공동 상담사만 열람
    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)
    note_facade = CounselingNoteFacade(uow)
    program_facade = ProgramFacade(uow)
    member_facade = MemberFacade(uow)
    client_facade = ClientFacade(uow)
    schedule_facade = ScheduleFacade(uow)
    room_facade = RoomFacade(uow)

    await case_facade.verify_case_readable(case_id, center_id, owner_scope)

    case = await case_facade.get_case_with_response(case_id, center_id, None)

    program = await program_facade.find_program(case.program_id)
    if not program:
        raise EntityNotFoundException(f"Program not found: {case.program_id}")

    participants_response = await case_facade.list_participants_with_response(
        case_id, center_id, None, active_only=False
    )
    participants = participants_response.items

    client_ids = [
        p.participant_id
        for p in participants
        if p.participant_type == CaseParticipantType.CLIENT.value and p.is_active
    ]

    counselor_participants = [
        p
        for p in participants
        if p.participant_type == CaseParticipantType.COUNSELOR.value and p.is_active
    ]
    if not counselor_participants:
        raise EntityNotFoundException(f"No active counselor found for case: {case_id}")

    clients = await client_facade.list_clients_by_ids(client_ids) if client_ids else []

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
        for client in clients
    ]

    # facade-to-facade 금지: handler가 member+person 조립
    counselor_ids = [p.participant_id for p in counselor_participants]
    member_persons_map = await _build_member_persons_map(
        uow, member_facade, counselor_ids
    )

    # 대표 담당자: case.counselor_id 기준 (joined_at 순이 아님!)
    # case.counselor_id 와 일치하는 participant 를 우선 찾고, 없으면 첫 번째로 fallback.
    primary_member_id = case.counselor_id
    primary_participant = None
    for cp in counselor_participants:
        if cp.participant_id == primary_member_id:
            primary_participant = cp
            break
    if primary_participant is None:
        # 정합성 이슈: case.counselor_id 가 participants 에 없음. 첫 번째로 fallback.
        primary_participant = counselor_participants[0]
        primary_member_id = primary_participant.participant_id

    counselor_member, counselor_person = member_persons_map.get(
        primary_participant.participant_id, (None, None)
    )
    if not counselor_member:
        raise EntityNotFoundException(
            f"Member not found: {primary_participant.participant_id}"
        )
    counselor_name = counselor_person.name if counselor_person else "Unknown"

    # 전체 상담사 목록 — 대표를 맨 앞에 두고 나머지는 joined_at 순
    counselors_data: list[SessionCounselorInfo] = []
    for cp in counselor_participants:
        if cp.participant_id == primary_member_id:
            member, person = member_persons_map.get(cp.participant_id, (None, None))
            if member:
                counselors_data.append(
                    SessionCounselorInfo(
                        counselor_id=member.id,
                        counselor_name=person.name if person else "Unknown",
                    )
                )
            break
    for cp in counselor_participants:
        if cp.participant_id == primary_member_id:
            continue
        member, person = member_persons_map.get(cp.participant_id, (None, None))
        if member:
            counselors_data.append(
                SessionCounselorInfo(
                    counselor_id=member.id,
                    counselor_name=person.name if person else "Unknown",
                )
            )

    sessions = await session_facade.list_sessions_with_response(
        case_id, center_id, None
    )

    session_ids = [s.id for s in sessions]

    notes = await note_facade.list_notes_by_sessions(session_ids, center_id)
    # (session_id, client_id) → has_note 매핑
    note_map = {(n.counseling_session_id, n.client_id): True for n in notes}

    schedule_ids = [s.schedule_id for s in sessions]

    schedules = await schedule_facade.list_schedules_by_ids(schedule_ids)
    schedule_map = {s.id: s for s in schedules}

    room_ids = list(set(s.room_id for s in schedules if s.room_id))

    room_map = await room_facade.get_rooms_by_ids(room_ids)

    all_session_participants = []
    for session in sessions:
        participants = await session_facade.get_participants_by_session_id(
            session_id=session.id,
            center_id=center_id,
        )
        all_session_participants.extend([(session.id, p) for p in participants])

    client_participant_ids = list(
        set(
            p.participant_id
            for _, p in all_session_participants
            if p.participant_type == ParticipantType.CLIENT.value
        )
    )

    member_participant_ids = list(
        set(
            p.participant_id
            for _, p in all_session_participants
            if p.participant_type == ParticipantType.COUNSELOR.value
        )
    )

    participant_clients = (
        await client_facade.list_clients_by_ids(client_participant_ids)
        if client_participant_ids
        else []
    )
    client_name_map = {c.id: c.name for c in participant_clients}

    # facade-to-facade 금지: handler가 member+person 조립
    member_persons_map = await _build_member_persons_map(
        uow, member_facade, member_participant_ids
    )
    member_name_map = {
        member_id: person.name if person else "Unknown"
        for member_id, (member, person) in member_persons_map.items()
    }

    # 일정 시작일 기준 정렬 (created_at 순이 아닌 실제 시간순으로 session_number 부여)
    sessions = sorted(
        sessions,
        key=lambda s: schedule_map[s.schedule_id].start
        if s.schedule_id in schedule_map
        else datetime.max,
    )
    session_details = []
    for idx, session in enumerate(sessions):
        schedule = schedule_map.get(session.schedule_id)
        if schedule:
            room = room_map.get(schedule.room_id) if schedule.room_id else None

            session_participants = [
                p for sid, p in all_session_participants if sid == session.id
            ]

            client_infos = []
            counselor_infos = []

            for sp in session_participants:
                if sp.participant_type == ParticipantType.CLIENT.value:
                    participant_name = (
                        client_name_map.get(sp.participant_id) or "Unknown"
                    )
                    has_note = note_map.get((session.id, sp.participant_id), False)
                    client_infos.append(
                        SessionParticipantInfo(
                            session_participant_id=sp.id,
                            participant_type=sp.participant_type,
                            participant_id=sp.participant_id,
                            participant_name=participant_name,
                            attendance_status=sp.attendance_status,
                            is_consumed=sp.is_consumed
                            if sp.is_consumed is not None
                            else False,
                            memo=sp.memo,
                            has_note=has_note,
                        )
                    )
                else:  # counselor
                    counselor_name = member_name_map.get(sp.participant_id) or "Unknown"
                    counselor_infos.append(
                        SessionCounselorInfo(
                            counselor_id=sp.participant_id,
                            counselor_name=counselor_name,
                        )
                    )

            # 대표(schedule.member_id) 를 맨 앞에 두고 나머지는 기존 순서 유지.
            # 프론트(SessionListItem, ScheduleDetailCounselingBody)가 별도 정렬 없이
            # 첫 번째를 대표로 표시할 수 있도록 백엔드에서 정렬을 보장한다.
            session_primary_id = schedule.member_id
            counselor_infos.sort(
                key=lambda ci: 0 if ci.counselor_id == session_primary_id else 1
            )

            session_details.append(
                SessionDetailInfo(
                    session_id=session.id,
                    session_number=idx + 1,
                    schedule_id=session.schedule_id,
                    start=schedule.start,
                    end=schedule.end,
                    room_id=schedule.room_id,
                    room_name=room.name if room else None,
                    status=session.status.value,
                    clients=client_infos,
                    counselors=counselor_infos,
                )
            )

    first_session_start = None
    first_room_name = None
    if session_details:
        first_session = session_details[0]
        first_session_start = first_session.start
        first_room_name = first_session.room_name

    case_type_map = {
        "INDIVIDUAL": "individual",
        "GROUP": "group",
    }
    case_type = case_type_map.get(program.program_type, "individual")

    # 수정 권한은 주담당 전용 — 공동 상담사는 열람만 가능하므로 화면이 편집 UI를 접는다
    my_role = None
    if actor_membership_id:
        if case.counselor_id == actor_membership_id:
            my_role = "primary"
        elif any(
            p.participant_id == actor_membership_id for p in counselor_participants
        ):
            my_role = "assistant"

    return CounselingCaseDetailResponse(
        my_role=my_role,
        case_id=case.id,
        case_code=case.case_code,
        status=case.status,
        chief_complaint=case.chief_complaint,
        memo=case.memo,
        total_sessions=case.total_sessions,
        session_rule=case.session_rule,
        program_id=program.id,
        program_name=program.name,
        case_type=case_type,
        counselor_id=counselor_member.id,
        counselor_name=counselor_name,
        counselors=counselors_data,
        clients=clients_data,
        sessions=session_details,
        first_session_start=first_session_start,
        room_name=first_room_name,
        created_at=case.created_at,
        updated_at=case.updated_at,
        completed_at=None,  # TODO: CounselingCase 모델에 completed_at 필드 추가 필요
    )


TOOL = {
    "name": "get_counseling_case_detail_handler",
    "permission": "read:counseling",
    "purpose": "상담 케이스 하나의 전체 상세(프로그램·내담자·상담사·회기 목록·일정·노트 작성 여부)를 조회한다.",
    "keywords": [
        "get counseling case detail",
        "케이스 상세",
        "상담 상세 보기",
        "케이스 정보",
        "회기 목록 조회",
        "상담 내용",
        "내담자 상담사 보기",
        "상세 페이지",
        "케이스 열람",
    ],
    "boundaries": "케이스 단건의 모든 상세를 풍부하게 조립해 보여주는 읽기 도구다. 여러 케이스를 페이지로 나열하려면 list_counseling_cases_enriched_handler를, 내 담당 케이스만 보려면 list_my_counseling_cases_handler를, 특정 회기의 참여자만 보려면 list_session_participants_handler를 쓴다. 권한 범위가 본인이면 주담당·공동 상담사로 참여한 케이스만 열람된다.",
    "output": "상담 케이스 전체 상세 (CounselingCaseDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "상세를 조회할 상담 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
