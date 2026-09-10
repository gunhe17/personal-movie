from datetime import timedelta

from app.core.datetime_utils import utc_now

from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import (
    SubscriptionStatus,
    get_trial_plan,
    get_trial_duration_days,
    get_credit_cycle_days,
)
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.schemas import PlanTransition


class CreateTrialSubscriptionService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        duration_days: int | None = None,
    ) -> tuple[SubscriptionAtomic | None, Subscription, PlanTransition | None]:
        # load
        existing = await self.repo.find_in_center(center_id=center_id)
        if existing:
            return None, existing, None

        trial_plan = get_trial_plan()
        days = duration_days if duration_days is not None else get_trial_duration_days()
        cycle = get_credit_cycle_days()
        now = utc_now()

        # create
        sub = await self.repo.add_in_center(
            center_id=center_id,
            plan=trial_plan,
            status=SubscriptionStatus.TRIAL,
            current_period_start=now,
            current_period_end=now + timedelta(days=cycle),
            trial_end=now + timedelta(days=days),
        )

        # return (history 기록은 facade가 PlanTransition으로 수행)
        transition = PlanTransition(
            subscription_id=sub.id,
            from_plan=None,
            to_plan=trial_plan,
            actor_type="system",
            reason="trial_creation",
            changed_at=now,
        )

        atomic, _ = SubscriptionAtomic.of(
            act="created", subscription=sub, transition=transition
        )
        return atomic, sub, transition
