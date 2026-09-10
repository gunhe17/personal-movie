from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppNotificationSettingItem
from app.modules.notification.facade import NotificationFacade


async def list_app_notification_settings_handler(
    *,
    account_id: uuid_str,
    uow: UnitOfWork,
) -> list[AppNotificationSettingItem]:
    async with uow:
        settings = await NotificationFacade(uow).list_settings(account_id=account_id)
        return [
            AppNotificationSettingItem(
                category=setting.category,
                channel_in_app=setting.channel_in_app,
                channel_push=setting.channel_push,
            )
            for setting in settings
        ]
