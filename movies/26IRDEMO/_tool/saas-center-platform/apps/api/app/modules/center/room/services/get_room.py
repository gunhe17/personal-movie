from ..repository import RoomRepository
from ..models import Room


class GetRoomService:
    def __init__(self, repo: RoomRepository):
        self.repo = repo

    async def execute(
        self,
        room_id: str,
        center_id: str,
    ) -> Room:
        # load
        room = await self.repo.get_in_center(room_id=room_id, center_id=center_id)

        return room
