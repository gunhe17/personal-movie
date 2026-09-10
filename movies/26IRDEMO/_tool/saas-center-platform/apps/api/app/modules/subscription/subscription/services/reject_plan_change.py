from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import SubscriptionStatus
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.schemas import PlanTransition


class RejectPlanChangeService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        reason: str = "plan_change_rejected",
    ) -> tuple[SubscriptionAtomic, Subscription, PlanTransition]:
        # load
        sub = await self.repo.get_in_center_for_update(center_id=center_id)

        # verify
        if SubscriptionStatus(sub.status) != SubscriptionStatus.PENDING:
            raise InvalidOperationException(
                f"거절할 수 있는 상태가 아닙니다. 현재 상태: {sub.status}"
            )

        now = utc_now()
        requested_plan = sub.reserved_plan or "unknown"
        plan = sub.plan

        # update
        updated = await self.repo.update_in_center(
            subscription_id=sub.id,
            center_id=center_id,
            status=SubscriptionStatus.ACTIVE,
            reserved_plan=None,
            reserved_at=None,
        )

        # return (history 기록은 facade가 PlanTransition으로 수행)
        transition = PlanTransition(
            subscription_id=sub.id,
            from_plan=plan,
            to_plan=plan,
            from_status=SubscriptionStatus.PENDING,
            to_status=SubscriptionStatus.ACTIVE,
            actor_type="admin",
            reason=f"{reason}:{requested_plan}",
            changed_at=now,
        )

        atomic, _ = SubscriptionAtomic.of(
            act="plan_change_rejected", subscription=updated, transition=transition
        )
        return atomic, updated, transition
