from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.notification.facade import NotificationFacade


async def unregister_app_push_token_handler(
    *,
    account_id: uuid_str,
    token: str,
    uow: UnitOfWork,
) -> None:
    async with uow:
        await NotificationFacade(uow).unregister_push_token(
            account_id=account_id,
            token=token,
        )
