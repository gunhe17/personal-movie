from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import SubscriptionStatus
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.schemas import PlanTransition


class ApprovePlanChangeService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
    ) -> tuple[SubscriptionAtomic, Subscription, PlanTransition]:
        # load
        sub = await self.repo.get_in_center_for_update(center_id=center_id)

        # verify
        if SubscriptionStatus(sub.status) != SubscriptionStatus.PENDING:
            raise InvalidOperationException(
                f"승인할 수 있는 상태가 아닙니다. 현재 상태: {sub.status}"
            )

        if not sub.reserved_plan:
            raise InvalidOperationException("예약된 플랜이 없습니다.")

        now = utc_now()
        old_plan = sub.plan
        new_plan = sub.reserved_plan

        # update
        updated = await self.repo.update_in_center(
            subscription_id=sub.id,
            center_id=center_id,
            plan=new_plan,
            status=SubscriptionStatus.ACTIVE,
            reserved_plan=None,
            reserved_at=None,
        )

        # return (history 기록은 facade가 PlanTransition으로 수행)
        transition = PlanTransition(
            subscription_id=sub.id,
            from_plan=old_plan,
            to_plan=new_plan,
            from_status=SubscriptionStatus.PENDING,
            to_status=SubscriptionStatus.ACTIVE,
            actor_type="admin",
            reason="plan_change_approved",
            changed_at=now,
        )

        atomic, _ = SubscriptionAtomic.of(
            act="plan_change_approved", subscription=updated, transition=transition
        )
        return atomic, updated, transition
