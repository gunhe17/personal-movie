"""상담실(Room) 픽스처."""
from sqlalchemy import select

from app.modules.center.room.models import Room

from scripts.seed.develop import gen_id


async def seed_room(session, center_id: str) -> str:
    """상담실 생성. Returns: room_id"""
    print("\n🚪 상담실 생성 중...")

    existing = await session.execute(
        select(Room).where(
            Room.center_id == center_id,
            Room.name == "상담실 1",
            Room.deleted_at.is_(None),
        )
    )
    room = existing.scalar_one_or_none()
    if room:
        print(f"  ⏭️  상담실 1 이미 존재")
        return room.id

    room_id = gen_id()
    room = Room(
        id=room_id,
        center_id=center_id,
        name="상담실 1",
        description="개별 상담용 상담실",
        is_active=True,
    )
    session.add(room)
    await session.flush()
    print(f"  ✅ 상담실 1 생성 완료")
    return room_id
