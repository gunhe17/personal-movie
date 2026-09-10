from datetime import date, datetime, time
from math import ceil

from sqlalchemy import func, select

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import PriceList


class PriceListRepository(PostgresRepository[PriceList]):
    model = PriceList

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        service_type: str,
        service_name: str,
        unit_price: int,
        is_active: bool,
        source: str,
        created_by: uuid_str,
        reference_id: uuid_str | None = None,
        memo: str | None = None,
    ) -> PriceList:
        return await super().add(
            PriceList(
                center_id=center_id,
                service_type=service_type,
                service_name=service_name,
                unit_price=unit_price,
                is_active=is_active,
                source=source,
                created_by=created_by,
                reference_id=reference_id,
                memo=memo,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        price_list_id: uuid_str,
        center_id: uuid_str,
        *,
        service_type: str = unset,
        service_name: str = unset,
        reference_id: uuid_str | None = unset,
        unit_price: int = unset,
        is_active: bool = unset,
        memo: str | None = unset,
        source: str = unset,
    ) -> PriceList | None:
        record = await self.find_in_center(
            price_list_id=price_list_id,
            center_id=center_id,
        )
        if record is None:
            return None
        return await self.update_fields(
            price_list_id,
            service_type=service_type,
            service_name=service_name,
            reference_id=reference_id,
            unit_price=unit_price,
            is_active=is_active,
            memo=memo,
            source=source,
        )

    @typecheck
    async def remove_in_center(
        self,
        price_list_id: uuid_str,
        center_id: uuid_str,
    ) -> None:
        record = await self.find_in_center(
            price_list_id=price_list_id,
            center_id=center_id,
        )
        if record is None:
            return
        await self.remove_by_id(price_list_id)

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        price_list_id: uuid_str,
        center_id: uuid_str,
    ) -> PriceList | None:
        return await self._find(
            where=[
                PriceList.id == price_list_id,
                PriceList.center_id == center_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        price_list_id: uuid_str,
        center_id: uuid_str,
    ) -> PriceList:
        record = await self.find_in_center(
            price_list_id=price_list_id,
            center_id=center_id,
        )
        if record is None:
            raise EntityNotFoundException(f"단가표 항목을 찾을 수 없습니다: {price_list_id}")
        return record

    @typecheck
    async def list_by_reference_ids(
        self,
        center_id: uuid_str,
        reference_ids: list[str],
    ) -> list[PriceList]:
        if not reference_ids:
            return []
        return await self._filter(
            where=[
                PriceList.center_id == center_id,
                PriceList.is_active.is_(True),
                PriceList.reference_id.in_(reference_ids),
            ]
        )

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        service_type: str | None = None,
        is_active: bool | None = None,
        search: str | None = None,
        *,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[PriceList], Page]:
        conditions = [
            PriceList.center_id == center_id,
            PriceList.deleted_at.is_(None),
        ]
        if service_type:
            conditions.append(PriceList.service_type == service_type)
        if is_active is not None:
            conditions.append(PriceList.is_active.is_(is_active))
        if search:
            conditions.append(PriceList.service_name.ilike(f"%{search}%"))

        total = await self._session.scalar(
            select(func.count()).select_from(PriceList).where(*conditions)
        )
        total = total or 0

        offset = (page - 1) * size
        stmt = (
            select(PriceList)
            .where(*conditions)
            .order_by(
                PriceList.is_active.desc(),
                PriceList.service_type.asc(),
                PriceList.service_name.asc(),
            )
            .offset(offset)
            .limit(size)
        )
        rows = await self._scalars(stmt)
        return rows, Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 200,
        service_type: str | None = None,
        service_name: str | None = None,
        is_active: bool | None = None,
        price_min: int | None = None,
        price_max: int | None = None,
        source: str | None = None,
        keyword: str | None = None,
        ids: list[str] | None = None,
        reference_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> tuple[list[PriceList], int]:
        where = [PriceList.center_id == center_id]
        if ids is not None:
            where.append(PriceList.id.in_(ids))
        if service_type:
            where.append(PriceList.service_type == service_type)
        search = keyword or service_name
        if search:
            where.append(PriceList.service_name.ilike(f"%{search}%"))
        if is_active is not None:
            where.append(PriceList.is_active.is_(is_active))
        if source:
            where.append(PriceList.source == source)
        if price_min is not None:
            where.append(PriceList.unit_price >= price_min)
        if price_max is not None:
            where.append(PriceList.unit_price <= price_max)
        if reference_id is not None:
            where.append(PriceList.reference_id == reference_id)
        if date_from:
            where.append(PriceList.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(PriceList.created_at <= datetime.combine(date_to, time.max))
        if sort:
            col, descending = resolve_sort(sort, columns=frozenset({"unit_price"}))
            order_col = getattr(PriceList, col)
            order = (order_col.desc() if descending else order_col.asc(),)
        else:
            order = (
                PriceList.is_active.desc(),
                PriceList.service_type.asc(),
                PriceList.service_name.asc(),
            )
        stmt = (
            select(PriceList)
            .where(PriceList.deleted_at.is_(None), *where)
            .order_by(*order)
            .limit(limit)
        )
        rows = await self._scalars(stmt)
        total = await self._count(where=where)
        return rows, total
