from datetime import timedelta

from app.core.datetime_utils import utc_now

from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import (
    PlanType,
    SubscriptionStatus,
)
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.schemas import PlanTransition


class CreateFreeSubscriptionService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
    ) -> tuple[SubscriptionAtomic | None, Subscription, PlanTransition | None]:
        # load
        existing = await self.repo.find_in_center(center_id=center_id)
        if existing:
            return None, existing, None

        now = utc_now()

        # create — free 는 무기한(100년)
        sub = await self.repo.add_in_center(
            center_id=center_id,
            plan=PlanType.FREE,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=36500),
        )

        # return (history 기록은 facade가 PlanTransition으로 수행)
        transition = PlanTransition(
            subscription_id=sub.id,
            from_plan=None,
            to_plan=PlanType.FREE,
            actor_type="system",
            reason="initial_creation",
            changed_at=now,
        )

        atomic, _ = SubscriptionAtomic.of(
            act="created", subscription=sub, transition=transition
        )
        return atomic, sub, transition
