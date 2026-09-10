from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.schemas import PlanTransition


class CancelDowngradeService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(self, center_id: str) -> tuple[SubscriptionAtomic, Subscription, PlanTransition]:
        # load
        sub = await self.repo.get_in_center_for_update(center_id=center_id)

        # verify
        if not sub.reserved_plan:
            raise InvalidOperationException("예약된 다운그레이드가 없습니다.")

        now = utc_now()
        cancelled_plan = sub.reserved_plan
        to_plan = sub.plan

        # update
        updated = await self.repo.update_in_center(
            subscription_id=sub.id,
            center_id=center_id,
            reserved_plan=None,
            reserved_at=None,
        )

        # return (history 기록은 facade가 PlanTransition으로 수행)
        transition = PlanTransition(
            subscription_id=sub.id,
            from_plan=cancelled_plan,
            to_plan=to_plan,
            actor_type="user",
            reason="downgrade_cancelled",
            changed_at=now,
        )

        atomic, _ = SubscriptionAtomic.of(act="downgrade_cancelled", subscription=updated, transition=transition)
        return atomic, updated, transition
