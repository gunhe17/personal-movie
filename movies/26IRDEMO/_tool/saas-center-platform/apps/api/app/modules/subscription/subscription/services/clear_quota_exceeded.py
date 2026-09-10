from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.repository import SubscriptionRepository


class ClearQuotaExceededService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
    ) -> tuple[SubscriptionAtomic | None, Subscription | None]:
        # load
        sub = await self.repo.find_in_center_for_update(center_id=center_id)
        if not sub or not sub.is_quota_exceeded:
            return None, sub

        # update
        updated = await self.repo.update_in_center(
            subscription_id=sub.id,
            center_id=center_id,
            is_quota_exceeded=False,
            quota_grace_end=None,
        )

        # return
        return SubscriptionAtomic.of(act="quota_exceeded_cleared", subscription=updated)
