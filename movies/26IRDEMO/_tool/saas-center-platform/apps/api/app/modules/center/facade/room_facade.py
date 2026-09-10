from app.core.type import unset
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..room.events import RoomAtomic
from ..room.models import Room
from ..room.repository import RoomRepository
from ..room.schemas import (
    RoomCreate,
    RoomResponse,
    RoomSummary,
)
from ..room.services import (
    CreateRoomService,
    GetRoomService,
    GetRoomsByIdsService,
    ListRoomsService,
    UpdateRoomService,
    DeleteRoomService,
)


class RoomFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def lookup_agent_ref(self, center_id: str, value: str) -> dict | None:
        ids = await self.list_room_ids_by_name(center_id, value)
        if not ids:
            return None
        room_map = await self.get_rooms_by_ids(ids[:1])
        room = room_map.get(ids[0])
        if not room:
            return None
        return {"id": room.id, "name": room.name}

    async def list_room_ids_by_name(
        self,
        center_id: str,
        name: str,
    ) -> list[str]:
        repo = self._uow.repo(RoomRepository)
        service = ListRoomsService(repo)
        rooms = await service.execute(center_id=center_id, skip=0, limit=100, name=name)
        return [r.id for r in rooms]

    async def get_rooms_by_ids(self, room_ids: list[str]) -> dict[str, Room]:
        if not room_ids:
            return {}

        repo = self._uow.repo(RoomRepository)
        service = GetRoomsByIdsService(repo)
        rooms = await service.execute(room_ids)
        return {room.id: room for room in rooms}

    async def get_room_summaries_by_ids(self, room_ids: list[str]) -> dict[str, str]:
        room_map = await self.get_rooms_by_ids(room_ids)
        return {rid: room.name for rid, room in room_map.items()}

    async def create_room(
        self,
        center_id: str,
        name: str,
        description: str | None = None,
        memo: str | None = None,
        thumbnail_url: str | None = None,
        is_active: bool = True,
        inactive_reason: str | None = None,
    ) -> tuple[RoomAtomic, Room]:
        repo = self._uow.repo(RoomRepository)
        service = CreateRoomService(repo)
        data = RoomCreate(
            name=name,
            description=description,
            memo=memo,
            thumbnail_url=thumbnail_url,
            is_active=is_active,
            inactive_reason=inactive_reason,
        )
        return await service.execute(center_id=center_id, **data.model_dump())

    async def get_room_with_response(
        self,
        room_id: str,
        center_id: str,
    ) -> RoomResponse:
        repo = self._uow.repo(RoomRepository)
        service = GetRoomService(repo)
        room = await service.execute(room_id, center_id)
        return RoomResponse.model_validate(room)

    async def list_rooms_with_response(
        self,
        center_id: str,
        skip: int = 0,
        limit: int = 50,
        active_only: bool = False,
    ) -> list[RoomSummary]:
        repo = self._uow.repo(RoomRepository)
        service = ListRoomsService(repo)
        rooms = await service.execute(center_id, skip, limit, active_only)
        return [RoomSummary.model_validate(room) for room in rooms]

    async def update_room(
        self,
        room_id: str,
        center_id: str,
        name: str = unset,
        description: str | None = unset,
        memo: str | None = unset,
        thumbnail_url: str | None = unset,
        is_active: bool = unset,
        inactive_reason: str | None = unset,
        changed: dict | None = None,
    ) -> tuple[RoomAtomic, Room]:
        repo = self._uow.repo(RoomRepository)
        service = UpdateRoomService(repo)
        fields = {
            "name": name,
            "description": description,
            "memo": memo,
            "thumbnail_url": thumbnail_url,
            "is_active": is_active,
            "inactive_reason": inactive_reason,
        }
        return await service.execute(
            room_id=room_id,
            center_id=center_id,
            changed=changed
            if changed is not None
            else {key: value for key, value in fields.items() if value is not unset},
            **fields,
        )

    async def delete_room(
        self,
        room_id: str,
        center_id: str,
    ) -> tuple[RoomAtomic, Room]:
        repo = self._uow.repo(RoomRepository)
        service = DeleteRoomService(repo)
        return await service.execute(room_id, center_id)
