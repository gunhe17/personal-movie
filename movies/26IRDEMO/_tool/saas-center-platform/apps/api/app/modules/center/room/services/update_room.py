from app.core.exceptions import ConflictException
from app.core.type import unset
from ..events import RoomAtomic
from ..repository import RoomRepository
from ..models import Room


class UpdateRoomService:
    def __init__(self, repo: RoomRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        room_id: str,
        center_id: str,
        changed: dict,
        name: str = unset,
        description: str | None = unset,
        memo: str | None = unset,
        thumbnail_url: str | None = unset,
        is_active: bool = unset,
        inactive_reason: str | None = unset,
    ) -> tuple[RoomAtomic, Room]:
        # load
        room = await self.repo.get_in_center(room_id=room_id, center_id=center_id)

        if name is not unset and name != room.name:
            existing = await self.repo.find_by_name(
                center_id=room.center_id,
                name=name,
            )
            if existing and existing.id != room.id and existing.deleted_at is None:
                raise ConflictException(
                    f"이미 존재하는 상담실 이름입니다: {name}"
                )

        update_data = {
            k: v
            for k, v in {
                "name": name,
                "description": description,
                "memo": memo,
                "thumbnail_url": thumbnail_url,
                "is_active": is_active,
                "inactive_reason": inactive_reason,
            }.items()
            if v is not unset
        }
        if not update_data:
            return RoomAtomic.updated(room=room, changed=changed)

        # return
        updated = await self.repo.update_in_place(room.id, **update_data)
        assert updated is not None
        return RoomAtomic.updated(room=updated, changed=changed)
