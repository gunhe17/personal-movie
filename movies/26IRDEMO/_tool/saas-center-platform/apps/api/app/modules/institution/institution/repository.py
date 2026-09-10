from datetime import date, datetime, time

from sqlalchemy import String

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import Institution


class InstitutionRepository(PostgresRepository[Institution]):
    model = Institution

    # #
    # command

    @typecheck
    async def add(
        self,
        name: str,
        phone: str | None = None,
        address: dict | None = None,
    ) -> Institution:
        return await super().add(
            Institution(
                name=name,
                phone=phone,
                address=address,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        phone: str | None = unset,
        address: dict | None = unset,
    ) -> Institution | None:
        return await self.update_fields(
            id,
            name=name,
            phone=phone,
            address=address,
        )

    # #
    # query

    @typecheck
    async def list_with_page(
        self,
        keyword: str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Institution], Page]:
        if keyword:
            return await self._page(
                where=[Institution.name.ilike(f"%{keyword}%")],
                order_by="name",
                page=page,
                size=size,
            )
        return await self._page(
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,  # 미사용 — 기관은 글로벌 카탈로그(파이프라인 통일 시그니처)
        *,
        sort: str | None = None,
        limit: int = 20,
        name: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Institution], int]:
        where = []
        if ids is not None:
            where.append(Institution.id.in_(ids))
        if name:
            where.append(Institution.name.ilike(f"%{name}%"))
        if phone:
            where.append(Institution.phone.ilike(f"%{phone}%"))
        if address:
            where.append(Institution.address.cast(String).ilike(f"%{address}%"))
        if date_from:
            where.append(Institution.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(Institution.created_at <= datetime.combine(date_to, time.max))
        col, descending = resolve_sort(sort, default_col="name", default_desc=False)
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total
