"""센터 운영시간(OperatingTime) + 휴무(NonOperatingTime) 픽스처."""
from datetime import time

from sqlalchemy import select

from app.modules.center.center_non_operating_time.models import NonOperatingTime
from app.modules.center.center_operating_time.models import OperatingTime

from scripts.seed.develop import gen_id, utc_now

# 평일 09:00-19:00 (점심 12:00-13:00), 토 09:00-13:00, 일 휴무
OPERATING = [
    ("MON", time(9, 0), time(19, 0), time(12, 0), time(13, 0)),
    ("TUE", time(9, 0), time(19, 0), time(12, 0), time(13, 0)),
    ("WED", time(9, 0), time(19, 0), time(12, 0), time(13, 0)),
    ("THU", time(9, 0), time(19, 0), time(12, 0), time(13, 0)),
    ("FRI", time(9, 0), time(19, 0), time(12, 0), time(13, 0)),
    ("SAT", time(9, 0), time(13, 0), None, None),
    ("SUN", None, None, None, None),
]

# (reason, year, month, day, month_week, weekday, start_time, end_time)
NON_OPERATING = [
    ("신정", 2027, 1, 1, None, None, None, None),
    ("매월 넷째 수요일 직원 교육", None, None, None, 4, "WED", time(14, 0), time(18, 0)),
]


async def seed_operating_times(session, center_id: str, accounts: dict) -> None:
    """운영시간 7행(요일 자연키) + 휴무 2건 생성."""
    print("\n🕘 센터 운영시간/휴무 생성 중...")

    existing = set((await session.execute(
        select(OperatingTime.weekday).where(
            OperatingTime.center_id == center_id,
            OperatingTime.deleted_at.is_(None),
        )
    )).scalars().all())

    created = 0
    for weekday, open_t, close_t, break_s, break_e in OPERATING:
        if weekday in existing:
            continue
        session.add(OperatingTime(
            id=gen_id(),
            center_id=center_id,
            weekday=weekday,
            open_time=open_t,
            close_time=close_t,
            break_start_time=break_s,
            break_end_time=break_e,
        ))
        created += 1
    print(f"  ✅ 운영시간 {created}행 생성 (기존 {len(existing)}행 유지)")

    admin_account_id = accounts["admin"][0]
    effective_from = utc_now().replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    for reason, year, month, day, month_week, weekday, start_t, end_t in NON_OPERATING:
        dup = (await session.execute(
            select(NonOperatingTime).where(
                NonOperatingTime.center_id == center_id,
                NonOperatingTime.reason == reason,
                NonOperatingTime.deleted_at.is_(None),
            )
        )).scalars().first()
        if dup:
            print(f"  ⏭️  휴무 '{reason}' 이미 존재")
            continue
        session.add(NonOperatingTime(
            id=gen_id(),
            center_id=center_id,
            created_by=admin_account_id,
            year=year,
            month=month,
            day=day,
            month_week=month_week,
            weekday=weekday,
            start_time=start_t,
            end_time=end_t,
            effective_from=effective_from,
            is_system_registered=False,
            reason=reason,
        ))
        print(f"  ✅ 휴무 '{reason}'")

    await session.flush()
