from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import PlanType, SubscriptionStatus
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.schemas import PlanTransition


class RequestPlanChangeService:
    # 플랜 변경 요청.
    #
    # 현재 플랜과 다른 플랜을 reserved_plan에 저장하고 status를 pending으로 변경.

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
        current_status = SubscriptionStatus(sub.status)

        if current_status == SubscriptionStatus.PENDING:
            raise InvalidOperationException(
                "이미 플랜 변경 요청이 진행 중입니다. 승인 대기 중입니다."
            )

        if current_status not in (
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
        ):
            raise InvalidOperationException(
                f"현재 상태({current_status.value})에서는 플랜 변경을 요청할 수 없습니다."
            )

        if sub.plan == target_plan.value:
            raise InvalidOperationException("현재 플랜과 동일한 플랜입니다.")

        now = utc_now()
        old_status = sub.status
        from_plan = sub.plan

        # update
        updated = await self.repo.update_in_center(
            subscription_id=sub.id,
            center_id=center_id,
            reserved_plan=target_plan.value,
            reserved_at=now,
            status=SubscriptionStatus.PENDING,
        )

        # return (history 기록은 facade가 PlanTransition으로 수행)
        transition = PlanTransition(
            subscription_id=sub.id,
            from_plan=from_plan,
            to_plan=target_plan.value,
            from_status=old_status,
            to_status=SubscriptionStatus.PENDING,
            actor_type="user",
            reason="plan_change_requested",
            changed_at=now,
        )

        atomic, _ = SubscriptionAtomic.of(act="plan_change_requested", subscription=updated, transition=transition)
        return atomic, updated, transition
