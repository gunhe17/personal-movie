from ..models import Room
from ..repository import RoomRepository


class ListRoomsByAgentFiltersService:
    def __init__(
        self,
        repo: RoomRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        sort: str = "asc",
        limit: int = 20,
        **filters,
    ) -> tuple[list[Room], int]:
        return await self._repo.list_agent_filtered(
            center_id, sort=sort, limit=limit, **filters,
        )
