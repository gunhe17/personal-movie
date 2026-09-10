"""상담사 근무시간(MemberWorkingTime) 픽스처."""
from datetime import time

from sqlalchemy import select

from app.modules.center.member_working_time.models import MemberWorkingTime

from scripts.seed.develop import gen_id

# member key → [(weekday, start, end, break_start, break_end)]
_FULLTIME = [
    ("MON", time(9, 0), time(18, 0), time(12, 0), time(13, 0)),
    ("TUE", time(9, 0), time(18, 0), time(12, 0), time(13, 0)),
    ("WED", time(9, 0), time(18, 0), time(12, 0), time(13, 0)),
    ("THU", time(9, 0), time(18, 0), time(12, 0), time(13, 0)),
    ("FRI", time(9, 0), time(18, 0), time(12, 0), time(13, 0)),
]
# 프리랜서 최치료 — 주 3일 오후 근무 + 토요일
_FREELANCER = [
    ("TUE", time(13, 0), time(20, 0), None, None),
    ("THU", time(13, 0), time(20, 0), None, None),
    ("SAT", time(9, 0), time(13, 0), None, None),
]

WORKING_TIMES = {
    "counselor1": _FULLTIME,
    "counselor2": _FREELANCER,
}


async def seed_member_working_times(
    session, center_id: str, members: dict[str, str]
) -> None:
    """상담사별 근무시간 생성 (member_id+weekday 자연키)."""
    print("\n⏰ 상담사 근무시간 생성 중...")

    for key, rows in WORKING_TIMES.items():
        member_id = members.get(key)
        if not member_id:
            print(f"  ⚠️  멤버 '{key}' 없음 - 스킵")
            continue

        existing = set((await session.execute(
            select(MemberWorkingTime.weekday).where(
                MemberWorkingTime.member_id == member_id,
                MemberWorkingTime.deleted_at.is_(None),
            )
        )).scalars().all())

        created = 0
        for weekday, start_t, end_t, break_s, break_e in rows:
            if weekday in existing:
                continue
            session.add(MemberWorkingTime(
                id=gen_id(),
                center_id=center_id,
                member_id=member_id,
                weekday=weekday,
                start_time=start_t,
                end_time=end_t,
                break_start_time=break_s,
                break_end_time=break_e,
            ))
            created += 1
        print(f"  ✅ {key}: {created}행 생성 (기존 {len(existing)}행)")

    await session.flush()
