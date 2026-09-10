from ..events import NotificationSettingAtomic
from ..models import NotificationSetting
from ..repository import NotificationSettingRepository


class UpsertSettingService:
    def __init__(
        self,
        repo: NotificationSettingRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        category: str,
        channel_in_app: bool,
        channel_push: bool,
        channel_alarmtalk: bool,
        center_id: str | None = None,
        event_type: str | None = None,
    ) -> tuple[NotificationSettingAtomic, NotificationSetting]:
        # load
        existing = await self.repo.find_by_account(
            center_id=center_id,
            account_id=account_id,
            category=category,
            event_type=event_type,
        )

        # mutate
        if existing:
            updated = await self.repo.update_in_place(
                id=existing.id,
                channel_in_app=channel_in_app,
                channel_push=channel_push,
                channel_alarmtalk=channel_alarmtalk,
            )
            return NotificationSettingAtomic.updated(
                setting=updated,
                changed={
                    "channel_in_app": channel_in_app,
                    "channel_push": channel_push,
                    "channel_alarmtalk": channel_alarmtalk,
                },
            )

        created = await self.repo.add(
            center_id=center_id,
            account_id=account_id,
            category=category,
            channel_in_app=channel_in_app,
            channel_push=channel_push,
            channel_alarmtalk=channel_alarmtalk,
            event_type=event_type,
        )

        # return
        return NotificationSettingAtomic.created(setting=created)
