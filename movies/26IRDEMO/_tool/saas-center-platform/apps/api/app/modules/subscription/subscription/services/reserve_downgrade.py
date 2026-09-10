from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import PlanType, is_downgrade
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.schemas import PlanTransition


class ReserveDowngradeService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        target_plan: PlanType,
    ) -> tuple[SubscriptionAtomic, Subscription, PlanTransition]:
        # load
        sub = await self.repo.get_in_center_for_update(center_id=center_id)

        # verify
        current = PlanType(sub.plan)
        if target_plan == current:
            raise InvalidOperationException(f"이미 {target_plan.value} 플랜입니다.")

        if not is_downgrade(current, target_plan):
            raise InvalidOperationException(
                f"{current.value} → {target_plan.value}은 다운그레이드가 아닙니다."
            )

        now = utc_now()
        from_plan = sub.plan

        # update
        updated = await self.repo.update_in_center(
            subscription_id=sub.id,
            center_id=center_id,
            reserved_plan=target_plan.value,
            reserved_at=now,
        )

        # return (history 기록은 facade가 PlanTransition으로 수행)
        transition = PlanTransition(
            subscription_id=sub.id,
            from_plan=from_plan,
            to_plan=target_plan.value,
            actor_type="user",
            reason="downgrade_reserved",
            changed_at=now,
        )

        atomic, _ = SubscriptionAtomic.of(act="downgrade_reserved", subscription=updated, transition=transition)
        return atomic, updated, transition
