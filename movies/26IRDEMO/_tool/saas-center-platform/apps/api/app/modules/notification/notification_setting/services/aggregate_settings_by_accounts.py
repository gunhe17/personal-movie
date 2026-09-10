from ..repository import NotificationSettingRepository
from ..models import NotificationSetting

class AggregateSettingsByAccountsService:
    def __init__(self, repo: NotificationSettingRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        account_ids: list[str],
        category: str,
    ) -> dict[str, NotificationSetting]:
        # return
        return await self.repo.aggregate_by_accounts_and_category(
            center_id=center_id,
            account_ids=account_ids,
            category=category,
        )

