from app.modules.subscription.subscription_history.repository import (
    SubscriptionHistoryRepository,
)


class CountChurnedSubscriptionsService:
    def __init__(
        self,
        repo: SubscriptionHistoryRepository,
    ):
        self.repo = repo

    async def execute(self) -> int:
        # return
        return await self.repo.count_churned_this_month_all_centers()
