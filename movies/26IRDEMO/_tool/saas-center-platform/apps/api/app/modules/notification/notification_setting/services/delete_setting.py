from ..events import NotificationSettingAtomic
from ..models import NotificationSetting
from ..repository import NotificationSettingRepository


class DeleteSettingService:
    def __init__(
        self,
        repo: NotificationSettingRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        setting_id: str,
        center_id: str,
        account_id: str,
    ) -> tuple[NotificationSettingAtomic, NotificationSetting]:
        # load
        setting = await self.repo.get_owned(
            setting_id, center_id=center_id, account_id=account_id
        )

        # remove
        await self.repo.hard_delete_by_id(id=setting_id)

        # return
        return NotificationSettingAtomic.deleted(setting=setting)
