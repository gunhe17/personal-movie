from ..repository import NotificationSettingRepository
from ..models import NotificationSetting

class FindEffectiveSettingService:
    def __init__(self, repo: NotificationSettingRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        category: str,
        center_id: str | None = None,
        event_type: str | None = None,
    ) -> NotificationSetting | None:
        # return
        return await self.repo.find_effective_setting(
            center_id=center_id,
            account_id=account_id,
            category=category,
            event_type=event_type,
        )

