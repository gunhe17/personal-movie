from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import (
    AppNotificationSettingItem,
    AppNotificationSettingUpdate,
)
from app.modules.notification.facade import NotificationFacade


async def upsert_app_notification_setting_handler(
    data: AppNotificationSettingUpdate,
    *,
    account_id: uuid_str,
    uow: UnitOfWork,
) -> AppNotificationSettingItem:
    async with uow:
        # 알림톡은 Client.phone 경로라 앱 계정과 무관 — 앱에서 토글해도 아무 동작이 없다
        setting = await NotificationFacade(uow).upsert_setting(
            account_id=account_id,
            category=data.category,
            channel_in_app=data.channel_in_app,
            channel_push=data.channel_push,
            channel_alarmtalk=False,
        )
        return AppNotificationSettingItem(
            category=setting.category,
            channel_in_app=setting.channel_in_app,
            channel_push=setting.channel_push,
        )
