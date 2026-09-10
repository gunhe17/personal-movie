from ..repository import NotificationSettingRepository
from ..models import NotificationSetting

class AggregateEffectiveSettingsBulkService:
    def __init__(self, repo: NotificationSettingRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        account_ids: list[str],
        category: str,
        event_type: str | None = None,
    ) -> dict[str, NotificationSetting]:
        # return
        return await self.repo.aggregate_effective_settings_bulk(
            center_id=center_id,
            account_ids=account_ids,
            category=category,
            event_type=event_type,
        )

