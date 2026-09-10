from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notification.facade import NotificationFacade
from app.modules.notification.notification.schemas import NotificationResponse


async def mark_app_notification_read_handler(
    *,
    event_group_id: uuid_str,
    account_id: uuid_str,
    notification_id: uuid_str,
    uow: UnitOfWork,
) -> NotificationResponse:
    async with uow:
        atomic, notification = await NotificationFacade(uow).mark_as_read_for_recipient(
            notification_id=notification_id,
            recipient_id=account_id,
        )
        await emit(
            uow,
            "notification_read",
            event_group_id=event_group_id,
            atomics=[atomic],
            center_id=notification.center_id,
        )

        return NotificationResponse.model_validate(notification)
