from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.subscription.subscription.plan_config import (
    PLAN_CREDIT_LIMITS,
    PlanType,
    SubscriptionStatus,
)
from app.modules.subscription.facade.subscription_facade import SubscriptionFacade

logger = get_logger(__name__)


async def roll_center_period_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
) -> bool:
    # 기간 경계 정산의 단일 권위 — 미도래 no-op. 호출자가 센터당 독립 tx로 감싸고(부분 실패 격리)
    # 구독 행 FOR UPDATE 로 동시 정산을 직렬화한다.
    subscription_facade = SubscriptionFacade(uow)
    credit = CreditFacade(uow)
    atomics = []

    sub = await subscription_facade.find_for_update(center_id)
    if sub is None:
        return False
    now = utc_now()

    # transition
    if sub.reserved_plan and sub.current_period_end < now:
        target = _plan_or_none(sub.reserved_plan)
        if target is None:
            target = PlanType.FREE
        atomic, updated = await subscription_facade.apply_plan_change(
            center_id,
            target,
            actor_type="system",
            reason="reserved_downgrade_applied",
        )
        atomics.append(atomic)
        eff_plan = updated.plan
        period_start, period_end = (
            updated.current_period_start,
            updated.current_period_end,
        )
    elif (
        sub.status == SubscriptionStatus.TRIAL and sub.trial_end and sub.trial_end < now
    ):
        atomic, updated = await subscription_facade.apply_plan_change(
            center_id,
            PlanType.FREE,
            actor_type="system",
            reason="trial_expired",
            validate_upgrade=False,
        )
        atomics.append(atomic)
        eff_plan = updated.plan
        period_start, period_end = (
            updated.current_period_start,
            updated.current_period_end,
        )
    elif (
        sub.reserved_plan is None
        and sub.plan != PlanType.FREE
        and sub.status == SubscriptionStatus.ACTIVE
        and sub.current_period_end < now
    ):
        # 예약 없이 만료된 유료 구독 → Free로 전환. expire_subscription(status=EXPIRED만)으로 두면
        # plan=pro/status=expired 림보(화면엔 Pro인데 AI 차단)에 영구 정체 — trial 만료와 동일하게 내린다.
        atomic, updated = await subscription_facade.apply_plan_change(
            center_id,
            PlanType.FREE,
            actor_type="system",
            reason="subscription_lapsed",
            validate_upgrade=False,
        )
        atomics.append(atomic)
        eff_plan = updated.plan
        period_start, period_end = (
            updated.current_period_start,
            updated.current_period_end,
        )
    else:
        return False

    # credit — 미터링 플랜은 새 한도로 리셋, Free/미지 플랜은 지갑 삭제.
    # Free는 미터링 없음(PLAN_CREDIT_LIMITS 미포함) — 유료 소비는 check_quota 정책이 담당.
    if eff_plan in PLAN_CREDIT_LIMITS:
        atomic, _ = await credit.initialize_credit(
            center_id, eff_plan, period_start, period_end
        )
        atomics.append(atomic)
    else:
        cleared, _ = await credit.clear_credit(center_id)
        atomics.extend(cleared)

    await emit(
        uow,
        "subscription_period_rolled",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_type="machine",
    )

    logger.info("period roll: center=%s plan=%s", center_id[:8], eff_plan)
    return True


def _plan_or_none(value: str) -> PlanType | None:
    try:
        return PlanType(value)
    except ValueError:
        return None
