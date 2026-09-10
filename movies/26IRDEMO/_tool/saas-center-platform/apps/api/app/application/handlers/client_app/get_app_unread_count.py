from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.notification.facade import NotificationFacade
from app.modules.notification.notification.schemas import UnreadCountResponse


async def get_app_unread_count_handler(
    *,
    account_id: uuid_str,
    uow: UnitOfWork,
) -> UnreadCountResponse:
    async with uow:
        return await NotificationFacade(uow).get_unread_count_for_recipient_with_response(
            recipient_id=account_id,
        )
