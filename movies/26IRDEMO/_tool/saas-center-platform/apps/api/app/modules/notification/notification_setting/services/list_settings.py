from ..repository import NotificationSettingRepository
from ..models import NotificationSetting

class ListSettingsService:
    def __init__(self, repo: NotificationSettingRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        center_id: str | None = None,
    ) -> list[NotificationSetting]:
        # return
        return await self.repo.list_by_account(
            center_id=center_id,
            account_id=account_id,
        )

