from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notification.helpers import notify_members
from app.modules.platform_admin.center.facade import AdminCenterFacade


async def notify_assessment_unassigned_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    assessment_id: str,
    assessment_name: str,
) -> None:
    admin_member_ids = await AdminCenterFacade(uow).list_admin_member_ids(center_id)
    if not admin_member_ids:
        return

    atomics = []
    await notify_members(
        uow=uow,
        center_id=center_id,
        member_ids=admin_member_ids,
        category="system",
        event_type="assessment_unassigned",
        title="검사 할당 해제",
        body=f"{assessment_name}이(가) 센터에서 해제되었습니다.",
        priority="normal",
        data={"center_id": center_id, "assessment_id": assessment_id},
        event_ref_prefix=f"assessment_unassigned:{assessment_id}:{center_id}",
        atomics=atomics,
    )
    await emit(
        uow,
        "notifications_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_type="machine",
    )
