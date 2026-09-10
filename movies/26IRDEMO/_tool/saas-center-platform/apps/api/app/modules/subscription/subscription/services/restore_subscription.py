from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import SubscriptionStatus
from app.modules.subscription.subscription.repository import SubscriptionRepository


class RestoreSubscriptionService:
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
            status=SubscriptionStatus.ACTIVE,
        )

        # return
        return SubscriptionAtomic.of(act="restored", subscription=updated)
