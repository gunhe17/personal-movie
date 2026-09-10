from ..repository import RoomRepository
from ..models import Room


class ListRoomsService:
    def __init__(self, repo: RoomRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = False,
        name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
    ) -> list[Room]:
        effective_is_active: bool | None
        if is_active is not None:
            effective_is_active = is_active
        elif active_only:
            effective_is_active = True
        else:
            effective_is_active = None

        return await self.repo.list_by_center(
            center_id=center_id,
            skip=skip,
            limit=limit,
            name=name,
            description=description,
            is_active=effective_is_active,
        )
