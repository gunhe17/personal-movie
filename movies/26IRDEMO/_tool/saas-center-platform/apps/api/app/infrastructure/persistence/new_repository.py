from math import ceil
from typing import Any, Generic, TypedDict, TypeVar

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy import update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset

from .models import BaseModel

M = TypeVar("M", bound=BaseModel)


class Page(TypedDict):
    total: int
    page: int
    size: int
    pages: int


def single_page(items: list) -> Page:
    # 비페이지 컬렉션(전체 반환) = 전체가 곧 1페이지. 가짜 메타가 아니라 degenerate 정본.
    n = len(items)
    return {"total": n, "page": 1, "size": n or 1, "pages": 1}


def offset_page(total: int, skip: int, limit: int) -> Page:
    # skip/limit 오프셋 → 정본 page 메타로 환산.
    size = limit or total or 1
    return {"total": total, "page": skip // size + 1, "size": size,
            "pages": ceil(total / size) if total else 0}


class PostgresRepository(Generic[M]):
    model: type[M]

    def __init__(self, session: AsyncSession):
        self._session = session

    # #
    # command

    async def add(self, instance: M) -> M:
        self._session.add(instance)
        await self._session.flush()
        await self._session.refresh(instance)
        return instance

    async def update_fields(self, id: str, **fields: Any) -> M | None:
        data = {k: v for k, v in fields.items() if v is not unset}
        stmt = (
            sql_update(self.model)
            .where(self.model.id == id, self.model.deleted_at.is_(None))
            .values(**data, updated_at=func.now())
            .returning(self.model)
        )
        model = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return model

    async def remove_by_id(self, id: str) -> M | None:
        stmt = (
            sql_update(self.model)
            .where(self.model.id == id, self.model.deleted_at.is_(None))
            .values(deleted_at=func.now())
            .returning(self.model)
        )
        model = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return model

    async def restore_by_id(self, id: str) -> M | None:
        stmt = (
            sql_update(self.model)
            .where(self.model.id == id, self.model.deleted_at.is_not(None))
            .values(deleted_at=None, updated_at=func.now())
            .returning(self.model)
        )
        model = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return model

    async def remove_where(self, *, where: list[ColumnElement[bool]]) -> int:
        stmt = (
            sql_update(self.model)
            .where(self.model.deleted_at.is_(None), *where)
            .values(deleted_at=func.now())
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount or 0

    # #
    # query

    # find: if not exists, return None

    async def find_by_id(self, id: str) -> M | None:
        return await self._find(where=[self.model.id == id])

    # get: if not exists, raise

    async def get_by_id(self, id: str) -> M:
        model = await self.find_by_id(id)
        if model is None:
            raise EntityNotFoundException(f"{self.model.__name__} not found: {id}")
        return model

    # #
    # helpers

    async def _page(
        self,
        *,
        where: list[ColumnElement[bool]] | None = None,
        page: int = 1,
        size: int = 20,
        order_by: str | None = None,
        descending: bool = False,
    ) -> tuple[list[M], Page]:
        items = await self._filter(
            where=where, order_by=order_by, descending=descending, limit=size, offset=(page - 1) * size
        )
        total = await self._count(where=where)
        return items, Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )

    async def _find_by(self, *, column: str, value: Any) -> M | None:
        return await self._find(where=[getattr(self.model, column) == value])

    async def _find(
        self,
        *,
        where: list[ColumnElement[bool]] | None = None,
        order_by: str | None = None,
        descending: bool = False,
        for_update: bool = False,
    ) -> M | None:
        rows = await self._filter(
            where=where, order_by=order_by, descending=descending, limit=1, for_update=for_update
        )
        return rows[0] if rows else None

    async def _filter(
        self,
        *,
        where: list[ColumnElement[bool]] | None = None,
        order_by: str | None = None,
        descending: bool = False,
        limit: int | None = None,
        offset: int | None = None,
        for_update: bool = False,
    ) -> list[M]:
        conditions = [self.model.deleted_at.is_(None), *(where or [])]
        stmt = select(self.model).where(*conditions)
        if order_by is not None:
            col = getattr(self.model, order_by)
            stmt = stmt.order_by(col.desc() if descending else col.asc())
        if offset is not None:
            stmt = stmt.offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)
        if for_update:
            stmt = stmt.with_for_update()
        return await self._scalars(stmt)

    async def _count(self, *, where: list[ColumnElement[bool]] | None = None) -> int:
        conditions = [self.model.deleted_at.is_(None), *(where or [])]
        n = await self._session.scalar(
            select(func.count()).select_from(self.model).where(*conditions)
        )
        return n or 0

    async def _next_seq(
        self,
        column: Any,
        *,
        where: list[ColumnElement[bool]] | None = None,
    ) -> int:
        conditions = [self.model.deleted_at.is_(None), *(where or [])]
        current = await self._session.scalar(select(func.max(column)).where(*conditions))
        return (current or 0) + 1

    async def _scalars(self, stmt: Select) -> list[M]:
        return list(await self._session.scalars(stmt))
