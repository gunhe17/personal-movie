from ..events import RoomAtomic
from ..models import Room
from ..repository import RoomRepository


class DeleteRoomService:
    def __init__(self, repo: RoomRepository):
        self.repo = repo

    async def execute(
        self,
        room_id: str,
        center_id: str,
    ) -> tuple[RoomAtomic, Room]:
        # verify
        room = await self.repo.get_in_center(room_id=room_id, center_id=center_id)

        # delete
        await self.repo.remove_by_id(id=room_id)
        return RoomAtomic.deleted(room=room)
