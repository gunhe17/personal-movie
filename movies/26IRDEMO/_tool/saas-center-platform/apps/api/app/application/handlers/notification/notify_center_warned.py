from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notification.helpers import notify_members
from app.modules.platform_admin.center.facade import AdminCenterFacade


async def notify_center_warned_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    reason: str,
    notify: bool,
) -> None:
    if not notify:
        return

    admin_member_ids = await AdminCenterFacade(uow).list_admin_member_ids(center_id)
    if not admin_member_ids:
        return

    atomics = []
    await notify_members(
        uow=uow,
        center_id=center_id,
        member_ids=admin_member_ids,
        category="system",
        event_type="center_warned",
        title="센터 경고 안내",
        body=f"약관 위반으로 경고가 발송되었습니다. 사유: {reason}",
        priority="normal",
        data={"center_id": center_id, "reason": reason},
        event_ref_prefix=f"center_warned:{center_id}",
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
