from datetime import date, datetime, time

from sqlalchemy import or_, select

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Room


class RoomRepository(PostgresRepository[Room]):
    model = Room

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        name: str,
        description: str | None = None,
        memo: str | None = None,
        thumbnail_url: str | None = None,
        is_active: bool = True,
        inactive_reason: str | None = None,
    ) -> Room:
        return await super().add(
            Room(
                center_id=center_id,
                name=name,
                description=description,
                memo=memo,
                thumbnail_url=thumbnail_url,
                is_active=is_active,
                inactive_reason=inactive_reason,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        description: str | None = unset,
        memo: str | None = unset,
        thumbnail_url: str | None = unset,
        is_active: bool = unset,
        inactive_reason: str | None = unset,
    ) -> Room | None:
        return await self.update_fields(
            id,
            name=name,
            description=description,
            memo=memo,
            thumbnail_url=thumbnail_url,
            is_active=is_active,
            inactive_reason=inactive_reason,
        )

    # #
    # query

    @typecheck
    async def get_in_center(
        self,
        room_id: uuid_str,
        center_id: uuid_str,
    ) -> Room:
        room = await self._find(
            where=[
                Room.id == room_id,
                Room.center_id == center_id,
            ]
        )
        if room is None:
            raise EntityNotFoundException(f"상담실을 찾을 수 없습니다: {room_id}")
        return room

    @typecheck
    async def list_by_center(
        self,
        center_id: uuid_str,
        name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Room]:
        where = [Room.center_id == center_id]
        if name is not None:
            where.append(Room.name.ilike(f"%{name}%"))
        if description is not None:
            where.append(Room.description.ilike(f"%{description}%"))
        if is_active is not None:
            where.append(Room.is_active.is_(is_active))
        return await self._filter(
            where=where,
            order_by="name",
            limit=limit,
            offset=skip,
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        name: str | None = None,
        is_active: bool | None = None,
        keyword: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Room], int]:
        where = [Room.center_id == center_id]
        if ids is not None:
            where.append(Room.id.in_(ids))
        if name:
            where.append(Room.name.ilike(f"%{name}%"))
        if is_active is not None:
            where.append(Room.is_active.is_(is_active))
        if keyword:
            where.append(or_(
                Room.description.ilike(f"%{keyword}%"),
                Room.memo.ilike(f"%{keyword}%"),
            ))
        if date_from:
            where.append(Room.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(Room.created_at <= datetime.combine(date_to, time.max))
        col, descending = resolve_sort(sort, default_col="name", default_desc=False)
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def list_active_by_center(
        self,
        center_id: uuid_str,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Room]:
        return await self._filter(
            where=[
                Room.center_id == center_id,
                Room.is_active.is_(True),
            ],
            order_by="name",
            limit=limit,
            offset=skip,
        )

    @typecheck
    async def count_by_center(
        self,
        center_id: uuid_str,
    ) -> int:
        return await self._count(where=[Room.center_id == center_id])

    @typecheck
    async def find_by_name(
        self,
        center_id: uuid_str,
        name: str,
    ) -> Room | None:
        return await self._find(
            where=[
                Room.center_id == center_id,
                Room.name == name,
            ]
        )

    @typecheck
    async def list_by_ids(
        self,
        room_ids: list[str],
    ) -> list[Room]:
        if not room_ids:
            return []

        return await self._scalars(
            select(Room).where(
                Room.deleted_at.is_(None),
                Room.id.in_(room_ids),
            )
        )
