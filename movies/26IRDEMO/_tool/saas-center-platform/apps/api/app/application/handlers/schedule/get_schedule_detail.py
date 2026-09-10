from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentSessionFacade
from app.modules.counseling.facade import CounselingSessionFacade
from app.modules.client.facade import ClientFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.center.facade import MemberFacade, RoomFacade, ProgramFacade
from app.modules.person.facade import PersonFacade
from app.modules.schedule.schedule.schemas import (
    ScheduleResponse,
    SessionSummary,
    ClientSummary,
    AssessmentInfo,
    SessionCounselorInfo,
)


async def get_schedule_detail_handler(
    center_id: str,
    schedule_id: str,
    uow: UnitOfWork,
) -> ScheduleResponse:
    schedule_facade = ScheduleFacade(uow)
    schedule = await schedule_facade.get_schedule(schedule_id, center_id)

    assessment_facade = AssessmentSessionFacade(uow)
    counseling_facade = CounselingSessionFacade(uow)

    assessment_sessions = await assessment_facade.get_sessions_by_schedule_ids(
        [schedule_id]
    )
    counseling_sessions = await counseling_facade.get_sessions_by_schedule_ids(
        [schedule_id]
    )
    sessions_with_participants = assessment_sessions + counseling_sessions

    room_facade = RoomFacade(uow)
    room_name = None
    if schedule.room_id:
        room_map = await room_facade.get_rooms_by_ids([schedule.room_id])
        room = room_map.get(schedule.room_id)
        if room:
            room_name = room.name

    if not sessions_with_participants:
        response = ScheduleResponse.model_validate(schedule)
        response.sessions = []
        response.room_name = room_name
        return response

    all_client_ids = []
    for session in sessions_with_participants:
        all_client_ids.extend(
            [p["participant_id"] for p in session.client_participants]
        )

    client_facade = ClientFacade(uow)
    client_map = await client_facade.get_clients_by_ids(all_client_ids)

    # 대표 담당자는 schedule.member_id(회기 수준 대표, 캘린더 색상/필터용),
    # 전체 담당자는 counseling session_participants(type='counselor') — 그룹 상담 등 다중 담당자 지원.
    counseling_session_ids = [s.session_id for s in counseling_sessions if s.session_id]
    session_counselor_map: dict[str, list[str]] = {
        sid: [] for sid in counseling_session_ids
    }
    all_member_ids: set[str] = set()
    if schedule.member_id:
        all_member_ids.add(schedule.member_id)

    if counseling_session_ids:
        session_participants = await counseling_facade.get_participants_by_session_ids(
            counseling_session_ids
        )
        for p in session_participants:
            if p.participant_type == "counselor":
                session_counselor_map.setdefault(p.session_id, []).append(
                    p.participant_id
                )
                all_member_ids.add(p.participant_id)

    member_facade = MemberFacade(uow)
    member_map = await member_facade.get_members_by_ids(list(all_member_ids))
    person_map = await PersonFacade(uow).get_persons_by_ids(
        [m.person_id for m in member_map.values()]
    )

    counselor_map = {}
    for member_id, member in member_map.items():
        person = person_map.get(member.person_id)
        counselor_map[member_id] = person.name if person else None

    # 이 schedule 의 대표 담당자 이름 (schedule.member_id 기준, deprecated field 용)
    schedule_counselor_name = (
        counselor_map.get(schedule.member_id) if schedule.member_id else None
    )

    program_ids = list(
        {
            getattr(s, "program_id", None)
            for s in sessions_with_participants
            if getattr(s, "program_id", None)
        }
    )
    program_map: dict[str, str] = {}
    if program_ids:
        program_facade = ProgramFacade(uow)
        program_map_full = await program_facade.get_programs_by_ids(program_ids)
        program_map = {pid: p.name for pid, p in program_map_full.items()}

    sessions_data = []
    for session in sessions_with_participants:
        clients_data = []
        for participant in session.client_participants:
            client_info = client_map.get(participant["participant_id"])
            if client_info:
                clients_data.append(
                    ClientSummary(
                        client_id=client_info.client_id,
                        client_name=client_info.name,
                        attendance_status=participant["attendance_status"],
                    )
                )

        set_codes = getattr(session, "set_assessment_codes", set())
        assessments = [
            AssessmentInfo(
                id=a.get("id"),
                code=a["code"],
                kor_name=a["kor_name"],
                belongs_to_set=a["code"] in set_codes,
            )
            for a in session.assessment_summary
        ]

        # 대표 담당자 이름 (deprecated: 하위 호환용 — 신규 코드는 counselors 사용)
        counselor_name = schedule_counselor_name

        # 전체 담당자 리스트 (counseling 세션만). Assessment 는 빈 리스트.
        # 정렬: schedule.member_id (대표) 가 맨 앞. 프론트는 counselors[0] = 대표
        # 로 가정할 수 있어서 추가 매칭 로직 불필요.
        session_counselor_ids = session_counselor_map.get(session.session_id, [])
        primary_id = schedule.member_id
        sorted_member_ids: list[str] = []
        if primary_id and primary_id in session_counselor_ids:
            sorted_member_ids.append(primary_id)
        for mid in session_counselor_ids:
            if mid != primary_id and mid not in sorted_member_ids:
                sorted_member_ids.append(mid)

        counselors_list: list[SessionCounselorInfo] = []
        for member_id in sorted_member_ids:
            name = counselor_map.get(member_id)
            if name:
                counselors_list.append(
                    SessionCounselorInfo(
                        counselor_id=member_id,
                        counselor_name=name,
                    )
                )

        # program_name 산출 (counseling: Program.name / assessment: 첫 검사 kor_name)
        session_program_id = getattr(session, "program_id", None)
        program_name: str | None = None
        if schedule.schedule_type == "counseling":
            if session_program_id:
                program_name = program_map.get(session_program_id)
        elif schedule.schedule_type == "assessment":
            if assessments:
                program_name = assessments[0].kor_name

        sessions_data.append(
            SessionSummary(
                session_id=session.session_id,
                case_id=session.case_id,
                case_code=session.case_code,
                case_type=session.case_type,
                session_number=session.session_number,
                status=session.status,
                cancel_reason=getattr(session, "cancel_reason", None),
                counselor_name=counselor_name,
                counselors=counselors_list,
                assessments=assessments,
                program_id=session_program_id,
                program_name=program_name,
                set_id=getattr(session, "set_id", None),
                set_name=getattr(session, "set_name", None),
                clients=clients_data,
            )
        )

    response = ScheduleResponse.model_validate(schedule)
    response.sessions = sessions_data
    response.room_name = room_name

    return response


TOOL = {
    "name": "get_schedule_detail_handler",
    "permission": "read:schedule",
    "purpose": "일정 한 건의 상세를 조회한다.",
    "keywords": [
        "get schedule detail",
        "일정 조회",
        "스케줄 상세",
        "예약 상세",
        "일정 보기",
    ],
    "boundaries": "단건 일정 상세(읽기 전용). 목록은 list_schedules_handler.",
    "output": "일정 상세 (ScheduleResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "schedule_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 일정",
                "description": "조회할 일정의 UUID.",
            },
        },
        "required": ["schedule_id"],
    },
}
