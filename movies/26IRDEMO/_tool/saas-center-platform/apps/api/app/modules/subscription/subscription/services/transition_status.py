from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.subscription.subscription.events import SubscriptionAtomic
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import SubscriptionStatus
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.schemas import PlanTransition


VALID_TRANSITIONS: dict[SubscriptionStatus, set[SubscriptionStatus]] = {
    SubscriptionStatus.TRIAL: {
        SubscriptionStatus.ACTIVE,  # 결제 완료
        SubscriptionStatus.EXPIRED,  # 체험 만료
    },
    SubscriptionStatus.ACTIVE: {
        SubscriptionStatus.PENDING,  # 플랜 변경 요청 (관리자 승인 대기)
        SubscriptionStatus.PENDING_PAYMENT,  # 갱신 결제 대기
        SubscriptionStatus.CANCELLED,  # 해지
    },
    SubscriptionStatus.PENDING: {
        SubscriptionStatus.ACTIVE,  # 승인 또는 거절 시 active로 복원
    },
    SubscriptionStatus.PENDING_PAYMENT: {
        SubscriptionStatus.ACTIVE,  # 결제 성공
        SubscriptionStatus.PAYMENT_FAILED,  # 결제 실패
    },
    SubscriptionStatus.PAYMENT_FAILED: {
        SubscriptionStatus.ACTIVE,  # 재결제 성공
        SubscriptionStatus.CANCELLED,  # 최종 해지
    },
    SubscriptionStatus.CANCELLED: {
        SubscriptionStatus.ACTIVE,  # 재가입
    },
    SubscriptionStatus.EXPIRED: {
        SubscriptionStatus.ACTIVE,  # 재가입
    },
}


class TransitionStatusService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        target_status: SubscriptionStatus,
        *,
        actor_type: str = "system",
        reason: str,
        force: bool = False,
    ) -> tuple[SubscriptionAtomic, Subscription, PlanTransition]:
        # load
        sub = await self.repo.get_in_center_for_update(center_id=center_id)

        # verify
        current_status = SubscriptionStatus(sub.status)

        if current_status == target_status:
            raise InvalidOperationException(f"이미 {target_status.value} 상태입니다.")

        if not force:
            allowed = VALID_TRANSITIONS.get(current_status, set())
            if target_status not in allowed:
                allowed_str = ", ".join(s.value for s in allowed) if allowed else "없음"
                raise InvalidOperationException(
                    f"{current_status.value} → {target_status.value} 전이는 허용되지 않습니다. "
                    f"허용: {allowed_str}"
                )

        now = utc_now()
        old_status = sub.status
        plan = sub.plan

        # update
        if target_status == SubscriptionStatus.CANCELLED:
            updated = await self.repo.update_in_center(
                subscription_id=sub.id,
                center_id=center_id,
                status=target_status,
                cancelled_at=now,
                reserved_plan=None,
                reserved_at=None,
            )
        else:
            updated = await self.repo.update_in_center(
                subscription_id=sub.id,
                center_id=center_id,
                status=target_status,
            )

        # return (history 기록은 facade가 PlanTransition으로 수행)
        transition = PlanTransition(
            subscription_id=sub.id,
            from_plan=plan,
            to_plan=plan,
            from_status=old_status,
            to_status=target_status,
            actor_type=actor_type,
            reason=f"force:{reason}" if force else reason,
            changed_at=now,
        )

        atomic, _ = SubscriptionAtomic.of(
            act="status_transitioned", subscription=updated, transition=transition
        )
        return atomic, updated, transition
