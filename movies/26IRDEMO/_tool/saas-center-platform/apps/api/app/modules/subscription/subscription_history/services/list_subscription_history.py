from app.modules.subscription.subscription_history.models import SubscriptionHistory
from app.modules.subscription.subscription_history.repository import (
    SubscriptionHistoryRepository,
)


class ListSubscriptionHistoryService:
    def __init__(
        self,
        repo: SubscriptionHistoryRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        subscription_id: str,
        *,
        limit: int = 20,
    ) -> list[SubscriptionHistory]:
        # return
        return await self.repo.list_by_subscription(
            subscription_id=subscription_id,
            limit=limit,
        )
