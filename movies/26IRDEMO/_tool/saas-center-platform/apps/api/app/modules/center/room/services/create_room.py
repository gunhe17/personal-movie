from app.core.exceptions import ConflictException
from ..events import RoomAtomic
from ..repository import RoomRepository
from ..models import Room


class CreateRoomService:
    def __init__(self, repo: RoomRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        name: str,
        description: str | None = None,
        memo: str | None = None,
        thumbnail_url: str | None = None,
        is_active: bool = True,
        inactive_reason: str | None = None,
    ) -> tuple[RoomAtomic, Room]:
        # verify
        existing = await self.repo.find_by_name(center_id=center_id, name=name)
        if existing and existing.deleted_at is None:
            raise ConflictException(f"이미 존재하는 상담실 이름입니다: {name}")

        # return
        room = await self.repo.add(
            center_id=center_id,
            name=name,
            description=description,
            memo=memo,
            thumbnail_url=thumbnail_url,
            is_active=is_active,
            inactive_reason=inactive_reason,
        )
        return RoomAtomic.created(room=room)
