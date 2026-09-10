from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.repository import SubscriptionRepository


class FindSubscriptionForUpdateService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
    ) -> Subscription | None:
        # return
        return await self.repo.find_in_center_for_update(center_id=center_id)
