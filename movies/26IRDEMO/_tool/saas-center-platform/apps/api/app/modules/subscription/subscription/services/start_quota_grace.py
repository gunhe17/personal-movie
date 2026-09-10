from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import get_quota_grace_days
from app.modules.subscription.subscription.repository import SubscriptionRepository


class StartQuotaGraceService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        grace_days: int | None = None,
    ) -> tuple[SubscriptionAtomic | None, Subscription | None]:
        # load
        sub = await self.repo.find_in_center_for_update(center_id=center_id)
        if not sub:
            return None, None

        days = grace_days if grace_days is not None else get_quota_grace_days()

        # update
        updated = await self.repo.update_in_center(
            subscription_id=sub.id,
            center_id=center_id,
            is_quota_exceeded=True,
            quota_grace_end=utc_now() + timedelta(days=days),
        )

        # return
        return SubscriptionAtomic.of(act="quota_grace_started", subscription=updated)
