from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import SendLinkFacade
from app.modules.assessment.send_link.schemas import LinkTaskItem, LinkVerifyResponse
from app.modules.center.facade import MemberInvitationFacade

from .collect_link_journals import collect_link_journals
from .collect_link_schedules import collect_link_schedules


async def restore_link_session_handler(send_link_id: str, uow: UnitOfWork) -> LinkVerifyResponse:
    facade = SendLinkFacade(uow)
    link = await facade.get_active_link_public(send_link_id)
    verified = await facade.collect_tasks(link)
    schedules, task_schedules = await collect_link_schedules(verified, uow)
    journals = await collect_link_journals(link, uow)
    return LinkVerifyResponse(
        access_token="",
        center_id=link.center_id,
        center_name=await MemberInvitationFacade(uow).get_center_name(link.center_id),
        case_id=link.case_id,
        recipient_name=(link.recipients or [{}])[0].get("name"),
        schedules=schedules,
        journals=journals,
        tasks=[LinkTaskItem(
            task_id=task.id, assessment_id=task.assessment_id,
            assessment_name=verified.assessment_names.get(task.assessment_id, "검사"),
            status=task.status, execution_method=task.execution_method,
            schedule_id=task_schedules.get(task.id),
            report_available=task.status == "completed" and bool(task.report_document_id) and task.is_report_visible_to_guardian,
        ) for task in verified.tasks],
    )
