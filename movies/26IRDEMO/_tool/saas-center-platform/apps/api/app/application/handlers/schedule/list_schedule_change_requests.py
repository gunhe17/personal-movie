from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentSessionFacade
from app.modules.center.facade import MemberFacade, ProgramFacade, RoomFacade
from app.modules.client.facade import ClientFacade
from app.modules.counseling.facade import CounselingSessionFacade
from app.modules.person.facade import PersonFacade
from app.modules.schedule.facade import ScheduleChangeRequestFacade, ScheduleFacade
from app.modules.schedule.schedule_change_request.schemas import ScheduleChangeRequestSummary


async def list_schedule_change_requests_handler(
    *,
    center_id: str,
    status: str | None,
    uow: UnitOfWork,
) -> list[ScheduleChangeRequestSummary]:
    # load
    requests = await ScheduleChangeRequestFacade(uow).list_change_requests(
        center_id=center_id,
        status=status,
    )
    if not requests:
        return []

    schedules = await ScheduleFacade(uow).list_schedules_by_ids([r.schedule_id for r in requests])
    schedule_by_id = {schedule.id: schedule for schedule in schedules}

    clients = await ClientFacade(uow).get_clients_by_ids([r.client_id for r in requests])

    member_ids = [s.member_id for s in schedules if s.member_id]
    members = await MemberFacade(uow).get_members_by_ids(member_ids)
    persons = await PersonFacade(uow).get_persons_by_ids([m.person_id for m in members.values()])

    rooms = await RoomFacade(uow).get_rooms_by_ids([s.room_id for s in schedules if s.room_id])

    # 프로그램은 일정이 아니라 회기가 갖는다 — 해소 규칙은 list_schedules와 동일해야 한다
    schedule_ids = [s.id for s in schedules]
    sessions = [
        *await AssessmentSessionFacade(uow).get_sessions_by_schedule_ids(schedule_ids),
        *await CounselingSessionFacade(uow).get_sessions_by_schedule_ids(schedule_ids),
    ]
    first_session_by_schedule: dict[str, object] = {}
    for session in sessions:
        first_session_by_schedule.setdefault(session.schedule_id, session)

    program_ids = [
        pid for session in sessions if (pid := getattr(session, "program_id", None))
    ]
    programs = await ProgramFacade(uow).get_programs_by_ids(program_ids) if program_ids else {}

    # assemble
    summaries: list[ScheduleChangeRequestSummary] = []
    for request in requests:
        schedule = schedule_by_id.get(request.schedule_id)
        member = members.get(schedule.member_id) if schedule and schedule.member_id else None
        person = persons.get(member.person_id) if member else None
        client = clients.get(request.client_id)
        room = rooms.get(schedule.room_id) if schedule and schedule.room_id else None

        program_name = None
        session = first_session_by_schedule.get(request.schedule_id)
        if schedule and session:
            if schedule.schedule_type == "counseling":
                program = programs.get(getattr(session, "program_id", None) or "")
                program_name = program.name if program else None
            elif schedule.schedule_type == "assessment":
                summary = getattr(session, "assessment_summary", None)
                program_name = summary[0].get("kor_name") if summary else None

        summaries.append(
            ScheduleChangeRequestSummary(
                id=request.id,
                center_id=request.center_id,
                schedule_id=request.schedule_id,
                client_id=request.client_id,
                client_name=client.name if client else None,
                client_birth_date=client.birth_date if client else None,
                client_gender=client.gender if client else None,
                client_profile_image_url=client.profile_image_url if client else None,
                title=schedule.title if schedule else None,
                program_name=program_name,
                session_number=getattr(session, "session_number", None),
                room_name=room.name if room else None,
                counselor_name=person.name if person else None,
                current_start=request.current_start,
                current_end=request.current_end,
                requested_start=request.requested_start,
                requested_end=request.requested_end,
                reason=request.reason,
                status=request.status,
                decision_note=request.decision_note,
                decided_at=request.decided_at,
                created_at=request.created_at,
            )
        )

    # return
    return summaries
