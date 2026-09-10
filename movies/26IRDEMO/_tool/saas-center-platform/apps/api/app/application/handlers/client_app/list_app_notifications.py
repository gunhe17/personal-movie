from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.notification.facade import NotificationFacade
from app.modules.notification.notification.schemas import NotificationListResponse


async def list_app_notifications_handler(
    *,
    account_id: uuid_str,
    category: str | None,
    is_read: bool | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> NotificationListResponse:
    async with uow:
        return await NotificationFacade(uow).list_for_recipient_with_response(
            recipient_id=account_id,
            category=category,
            is_read=is_read,
            page=page,
            size=size,
        )
