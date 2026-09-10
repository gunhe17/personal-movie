from ..repository import RoomRepository
from ..models import Room


class GetRoomsByIdsService:
    def __init__(self, repo: RoomRepository):
        self.repo = repo

    async def execute(self, room_ids: list[str]) -> list[Room]:
        if not room_ids:
            return []
        return await self.repo.list_by_ids(room_ids=room_ids)
