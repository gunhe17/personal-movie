"""구독(Subscription) 픽스처 — Pro 플랜."""
from sqlalchemy import select

from app.modules.subscription.subscription.models import Subscription

from scripts.seed.develop import gen_id, utc_now


async def seed_subscription_pro(session, center_id: str):
    """센터 구독을 Pro 플랜으로 업그레이드."""
    print("\n💎 구독 Pro 플랜 설정 중...")

    existing = await session.execute(
        select(Subscription).where(
            Subscription.center_id == center_id,
            Subscription.deleted_at.is_(None),
        )
    )
    sub = existing.scalar_one_or_none()

    now = utc_now()
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # 다음 달 1일
    if period_start.month == 12:
        period_end = period_start.replace(year=period_start.year + 1, month=1)
    else:
        period_end = period_start.replace(month=period_start.month + 1)

    if sub:
        if sub.plan == "pro":
            print(f"  ⏭️  이미 Pro 플랜 (ID: {sub.id[:8]}...)")
            return
        sub.plan = "pro"
        sub.status = "active"
        sub.current_period_start = period_start
        sub.current_period_end = period_end
        print(f"  ✅ {sub.plan} → pro 업그레이드 완료")
    else:
        sub = Subscription(
            id=gen_id(),
            center_id=center_id,
            plan="pro",
            status="active",
            current_period_start=period_start,
            current_period_end=period_end,
        )
        session.add(sub)
        print(f"  ✅ Pro 구독 생성 완료")

    await session.flush()
