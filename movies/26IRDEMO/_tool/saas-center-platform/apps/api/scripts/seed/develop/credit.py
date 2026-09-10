"""크레딧 잔액(CreditBalance) 픽스처.

한도는 플랜 설정(`PLAN_CREDIT_LIMITS`)에서 유도한다 — 시드가 숫자를 따로 들고 있으면
플랜 한도를 올려도 시드 센터만 옛 한도로 남아 AI 호출이 조용히 쿼터에 걸린다.
기간은 구독 기간과 맞춘다(`find_active_by_center` 가 `period_end > now` 로 거른다).
"""
from sqlalchemy import select

from app.modules.llm.credit_balance.models import CreditBalance
from app.modules.llm.credit_balance.plan_config import PLAN_CREDIT_LIMITS
from app.modules.subscription.subscription.models import Subscription

from scripts.seed.develop import gen_id, utc_now

PLAN = "pro"


async def seed_credit_balance(session, center_id: str):
    """활성 크레딧 잔액 보장 (없거나 만료됐으면 현재 기간으로 생성)."""
    print("\n🪙 크레딧 잔액 설정 중...")

    now = utc_now()
    credit_limit = PLAN_CREDIT_LIMITS[PLAN]

    sub = (await session.execute(
        select(Subscription).where(
            Subscription.center_id == center_id,
            Subscription.deleted_at.is_(None),
        )
    )).scalars().first()
    if sub and sub.current_period_end > now:
        period_start, period_end = sub.current_period_start, sub.current_period_end
    else:
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        period_end = (
            period_start.replace(year=period_start.year + 1, month=1)
            if period_start.month == 12
            else period_start.replace(month=period_start.month + 1)
        )

    active = (await session.execute(
        select(CreditBalance)
        .where(
            CreditBalance.center_id == center_id,
            CreditBalance.deleted_at.is_(None),
            CreditBalance.period_end > now,
        )
        .order_by(CreditBalance.period_end.desc())
    )).scalars().first()

    if active:
        if active.credit_limit != credit_limit:
            print(f"  🔧 한도 백필 {active.credit_limit:,} → {credit_limit:,}")
            active.credit_limit = credit_limit
        remaining = active.credit_limit - active.credit_used
        print(f"  ⏭️  활성 잔액 존재 ({remaining:,} / {active.credit_limit:,} 남음, ~{active.period_end:%Y-%m-%d})")
        return

    # 만료분은 남겨 둔다 — 사용 이력(`find_last_consumed_including_deleted`)의 근거다
    expired = (await session.execute(
        select(CreditBalance).where(
            CreditBalance.center_id == center_id,
            CreditBalance.deleted_at.is_(None),
        )
    )).scalars().all()
    if expired:
        print(f"  ℹ️  만료 잔액 {len(expired)}건 — 현재 기간 잔액을 새로 발급")

    session.add(CreditBalance(
        id=gen_id(),
        center_id=center_id,
        plan_type=PLAN,
        credit_limit=credit_limit,
        credit_used=0,
        period_start=period_start,
        period_end=period_end,
    ))
    await session.flush()
    print(
        f"  ✅ 크레딧 {credit_limit:,} 할당 "
        f"({period_start:%Y-%m-%d} ~ {period_end:%Y-%m-%d}, 플랜 {PLAN})"
    )
