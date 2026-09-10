from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.repository import SubscriptionRepository


class EndQuotaGraceService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        subscription_id: str,
        center_id: str,
    ) -> tuple[SubscriptionAtomic, Subscription]:
        # update
        updated = await self.repo.update_in_center(
            subscription_id=subscription_id,
            center_id=center_id,
            quota_grace_end=None,
        )

        # return
        return SubscriptionAtomic.of(act="quota_grace_ended", subscription=updated)
