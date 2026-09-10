from datetime import timedelta

from app.core.datetime_utils import utc_now

from app.core.exceptions import InvalidOperationException
from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import (
    PlanType,
    SubscriptionStatus,
    is_upgrade,
    get_credit_cycle_days,
)
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.schemas import PlanTransition


class UpgradePlanService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        new_plan: PlanType,
        *,
        actor_type: str = "admin",
        reason: str = "upgrade",
    ) -> tuple[SubscriptionAtomic, Subscription, PlanTransition]:
        # load
        sub = await self.repo.get_in_center_for_update(center_id=center_id)

        # verify
        current = PlanType(sub.plan)
        if new_plan == current:
            raise InvalidOperationException(f"이미 {new_plan.value} 플랜입니다.")

        if not is_upgrade(current, new_plan):
            raise InvalidOperationException(
                f"{current.value} → {new_plan.value} 업그레이드는 허용되지 않습니다."
            )

        now = utc_now()
        old_plan = sub.plan

        # update
        updated = await self.repo.update_in_center(
            subscription_id=sub.id,
            center_id=center_id,
            plan=new_plan,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=get_credit_cycle_days()),
            is_quota_exceeded=False,
            quota_grace_end=None,
        )

        # return (history 기록은 facade가 PlanTransition으로 수행)
        transition = PlanTransition(
            subscription_id=sub.id,
            from_plan=old_plan,
            to_plan=new_plan,
            actor_type=actor_type,
            reason=reason,
            changed_at=now,
        )

        atomic, _ = SubscriptionAtomic.of(
            act="upgraded", subscription=updated, transition=transition
        )
        return atomic, updated, transition
