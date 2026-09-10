from datetime import date, datetime, time

from sqlalchemy import select

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Program


class ProgramRepository(PostgresRepository[Program]):
    model = Program

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        name: str,
        program_type: str,
        price: int,
        duration_minutes: int,
        description: str | None = None,
    ) -> Program:
        return await super().add(
            Program(
                center_id=center_id,
                name=name,
                program_type=program_type,
                price=price,
                duration_minutes=duration_minutes,
                description=description,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        program_type: str = unset,
        price: int = unset,
        duration_minutes: int = unset,
        description: str | None = unset,
        is_active: bool = unset,
    ) -> Program | None:
        return await self.update_fields(
            id,
            name=name,
            program_type=program_type,
            price=price,
            duration_minutes=duration_minutes,
            description=description,
            is_active=is_active,
        )

    # #
    # query

    @typecheck
    async def get_in_center(
        self,
        program_id: uuid_str,
        center_id: uuid_str,
    ) -> Program:
        program = await self._find(
            where=[
                Program.id == program_id,
                Program.center_id == center_id,
            ]
        )
        if program is None:
            raise EntityNotFoundException(f"프로그램을 찾을 수 없습니다: {program_id}")
        return program

    @typecheck
    async def list_by_center(
        self,
        center_id: uuid_str,
        *,
        skip: int = 0,
        limit: int = 20,
    ) -> list[Program]:
        return await self._filter(
            where=[Program.center_id == center_id],
            order_by="name",
            limit=limit,
            offset=skip,
        )

    @typecheck
    async def count_by_center(self, center_id: uuid_str) -> int:
        return await self._count(where=[Program.center_id == center_id])

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        name: str | None = None,
        program_type: str | None = None,
        is_active: bool | None = None,
        keyword: str | None = None,
        price_min: int | None = None,
        price_max: int | None = None,
        duration_min: int | None = None,
        duration_max: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Program], int]:
        where = [Program.center_id == center_id]
        if ids is not None:
            where.append(Program.id.in_(ids))
        if name:
            where.append(Program.name.ilike(f"%{name}%"))
        if program_type:
            where.append(Program.program_type == program_type.upper())
        if is_active is not None:
            where.append(Program.is_active.is_(is_active))
        if keyword:
            where.append(Program.description.ilike(f"%{keyword}%"))
        if price_min is not None:
            where.append(Program.price >= price_min)
        if price_max is not None:
            where.append(Program.price <= price_max)
        if duration_min is not None:
            where.append(Program.duration_minutes >= duration_min)
        if duration_max is not None:
            where.append(Program.duration_minutes <= duration_max)
        if date_from:
            where.append(Program.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(Program.created_at <= datetime.combine(date_to, time.max))
        col, descending = resolve_sort(
            sort,
            columns=frozenset({"price", "duration_minutes"}),
            default_col="name",
            default_desc=False,
        )
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def find_by_name_and_type(
        self,
        center_id: uuid_str,
        name: str,
        program_type: str,
    ) -> Program | None:
        return await self._find(
            where=[
                Program.center_id == center_id,
                Program.name == name,
                Program.program_type == program_type,
            ]
        )

    @typecheck
    async def list_by_ids(self, program_ids: list[str]) -> list[Program]:
        if not program_ids:
            return []

        return await self._scalars(
            select(Program).where(
                Program.deleted_at.is_(None),
                Program.id.in_(program_ids),
            )
        )

    @typecheck
    async def list_by_name(
        self,
        center_id: uuid_str,
        name: str,
    ) -> list[Program]:
        return await self._filter(
            where=[
                Program.center_id == center_id,
                Program.name.ilike(f"%{name}%"),
            ],
            order_by="name",
        )

    @typecheck
    async def list_ids_by_type(
        self,
        center_id: uuid_str,
        program_type: str,
    ) -> list[str]:
        stmt = (
            select(Program.id)
            .where(
                Program.center_id == center_id,
                Program.program_type == program_type,
                Program.deleted_at.is_(None),
            )
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
