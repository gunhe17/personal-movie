from app.core.type import utc_dt
from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import (
    PlanType,
    SubscriptionStatus,
)
from app.modules.subscription.subscription.repository import SubscriptionRepository


class GrantTrialService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        subscription_id: str,
        center_id: str,
        *,
        trial_plan: PlanType,
        trial_end: utc_dt,
        period_start: utc_dt,
        period_end: utc_dt,
    ) -> tuple[SubscriptionAtomic, Subscription]:
        # update
        updated = await self.repo.update_in_center(
            subscription_id=subscription_id,
            center_id=center_id,
            plan=trial_plan,
            status=SubscriptionStatus.TRIAL,
            trial_end=trial_end,
            current_period_start=period_start,
            current_period_end=period_end,
            is_quota_exceeded=False,
            quota_grace_end=None,
            reserved_plan=None,
            reserved_at=None,
        )

        # return
        return SubscriptionAtomic.of(act="trial_granted", subscription=updated)
