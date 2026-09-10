from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.repository import SubscriptionRepository


class GetSubscriptionService:
    def __init__(self, repo: SubscriptionRepository):
        self.repo = repo

    async def execute(self, center_id: str) -> Subscription:
        # 활성 구독 반환. 없으면 EntityNotFoundException.
        return await self.repo.get_in_center(center_id=center_id)

    async def execute_or_none(self, center_id: str) -> Subscription | None:
        # 활성 구독 반환. 없으면 None.
        return await self.repo.find_in_center(center_id=center_id)
