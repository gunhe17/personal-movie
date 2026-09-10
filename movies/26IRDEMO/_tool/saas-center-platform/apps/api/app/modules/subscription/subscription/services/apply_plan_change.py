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


class ApplyPlanChangeService:
    # 플랜 즉시 변경.
    #
    # - 업그레이드: 결제 확인 후 즉시 적용
    # - 만료 전환: 스케줄러에서 예약된 다운그레이드 적용
    # - Admin 수동: 관리자 직접 변경

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
        actor_type: str = "user",
        reason: str = "upgrade",
        validate_upgrade: bool = False,
        act: str = "plan_applied",
    ) -> tuple[SubscriptionAtomic, Subscription, PlanTransition]:
        # load
        sub = await self.repo.get_in_center_for_update(center_id=center_id)

        # verify
        current = PlanType(sub.plan)
        if new_plan == current:
            raise InvalidOperationException(f"이미 {new_plan.value} 플랜입니다.")

        if validate_upgrade and not is_upgrade(current, new_plan):
            raise InvalidOperationException(
                f"{current.value} → {new_plan.value}은 업그레이드가 아닙니다."
            )

        now = utc_now()
        old_plan = sub.plan
        period_days = 36500 if new_plan == PlanType.FREE else get_credit_cycle_days()

        # update
        updated = await self.repo.update_in_center(
            subscription_id=sub.id,
            center_id=center_id,
            plan=new_plan,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=period_days),
            is_quota_exceeded=False,
            quota_grace_end=None,
            reserved_plan=None,
            reserved_at=None,
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

        atomic, _ = SubscriptionAtomic.of(act=act, subscription=updated, transition=transition)
        return atomic, updated, transition
