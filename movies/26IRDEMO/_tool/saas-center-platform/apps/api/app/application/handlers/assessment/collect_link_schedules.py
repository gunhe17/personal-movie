from datetime import timezone

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentSessionFacade
from app.modules.assessment.facade.send_link_facade import VerifiedLinkTasks
from app.modules.assessment.send_link.schemas import LinkScheduleItem
from app.modules.schedule.facade import ScheduleFacade


async def collect_link_schedules(
    verified: VerifiedLinkTasks, uow: UnitOfWork
) -> tuple[list[LinkScheduleItem], dict[str, str]]:
    link = verified.send_link
    sessions = await AssessmentSessionFacade(uow).list_sessions_by_case(link.case_id)
    linked_sessions = {
        session.id: session
        for session in sessions
        if session.center_id == link.center_id and session.case_id == link.case_id
    }
    names_by_schedule: dict[str, list[str]] = {}
    status_by_schedule: dict[str, str] = {}
    task_schedules: dict[str, str] = {}
    for task in verified.tasks:
        session = linked_sessions.get(task.session_id)
        if task.execution_method != "onsite" or not session or not session.schedule_id:
            continue
        task_schedules[task.id] = session.schedule_id
        names_by_schedule.setdefault(session.schedule_id, []).append(
            verified.assessment_names.get(task.assessment_id, "검사")
        )
        status_by_schedule[session.schedule_id] = session.status
    schedules = await ScheduleFacade(uow).list_schedules_by_ids(list(names_by_schedule)) if names_by_schedule else []
    items = [
        LinkScheduleItem(
            schedule_id=schedule.id,
            start=schedule.start.replace(tzinfo=timezone.utc),
            end=schedule.end.replace(tzinfo=timezone.utc),
            status=status_by_schedule[schedule.id],
            assessment_names=names_by_schedule[schedule.id],
        )
        for schedule in schedules
        if schedule.center_id == link.center_id and schedule.schedule_type == "assessment"
    ]
    allowed = {item.schedule_id for item in items}
    return sorted(items, key=lambda item: item.start), {
        task_id: schedule_id for task_id, schedule_id in task_schedules.items() if schedule_id in allowed
    }
