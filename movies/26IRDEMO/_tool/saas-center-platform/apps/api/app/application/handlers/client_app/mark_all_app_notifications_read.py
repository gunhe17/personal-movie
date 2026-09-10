from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.notification.facade import NotificationFacade
from app.modules.notification.notification.schemas import MarkAllReadResponse


async def mark_all_app_notifications_read_handler(
    *,
    account_id: uuid_str,
    uow: UnitOfWork,
) -> MarkAllReadResponse:
    async with uow:
        _, count = await NotificationFacade(uow).mark_all_as_read_for_recipient(
            recipient_id=account_id,
        )
        return MarkAllReadResponse(updated_count=count)
