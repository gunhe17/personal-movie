from datetime import date, datetime, time

from sqlalchemy import case, delete, func, select

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import OperatingTime

_WEEKDAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


class OperatingTimeRepository(PostgresRepository[OperatingTime]):
    model = OperatingTime

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        weekday: str,
        open_time: time | None = None,
        close_time: time | None = None,
        break_start_time: time | None = None,
        break_end_time: time | None = None,
    ) -> OperatingTime:
        return await super().add(
            OperatingTime(
                center_id=center_id,
                weekday=weekday,
                open_time=open_time,
                close_time=close_time,
                break_start_time=break_start_time,
                break_end_time=break_end_time,
            )
        )

    @typecheck
    async def hard_delete_by_center(self, center_id: uuid_str) -> None:
        # 물리 DELETE 의도적: bulk_update_operating_times 가 전건 삭제 후 재삽입(replace).
        # soft-delete면 (center_id, weekday) 재삽입 시 삭제행과 누적·충돌.
        await self._session.execute(
            delete(OperatingTime).where(OperatingTime.center_id == center_id)
        )

    # #
    # query

    @typecheck
    async def list_by_center(
        self,
        center_id: uuid_str,
        day_of_week: str | None = None,
        is_operating: bool | None = None,
    ) -> list[OperatingTime]:
        query = select(OperatingTime).where(
            OperatingTime.deleted_at.is_(None),
            OperatingTime.center_id == center_id,
        )
        if day_of_week is not None:
            query = query.where(OperatingTime.weekday == day_of_week)
        if is_operating is True:
            query = query.where(OperatingTime.open_time.is_not(None))
        elif is_operating is False:
            query = query.where(OperatingTime.open_time.is_(None))
        items = await self._scalars(query)
        return sorted(items, key=lambda x: _WEEKDAY_ORDER.index(x.weekday))

    @typecheck
    async def find_by_weekday(
        self,
        center_id: uuid_str,
        weekday: str,
    ) -> OperatingTime | None:
        query = select(OperatingTime).where(
            OperatingTime.deleted_at.is_(None),
            OperatingTime.center_id == center_id,
            OperatingTime.weekday == weekday,
        )
        items = await self._scalars(query)
        return items[0] if items else None

    @typecheck
    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        weekday: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list:
        where = [
            OperatingTime.center_id == center_id,
            OperatingTime.deleted_at.is_(None),
        ]
        if ids:
            where.append(OperatingTime.id.in_(ids))
        if weekday:
            where.append(OperatingTime.weekday == weekday)
        if date_from:
            where.append(OperatingTime.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(OperatingTime.created_at <= datetime.combine(date_to, time.max))
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        ids: list[str] | None = None,
        weekday: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[OperatingTime]:
        where = self._agent_where(
            center_id,
            ids=ids,
            weekday=weekday,
            date_from=date_from,
            date_to=date_to,
        )
        col, descending = resolve_sort(sort)
        order_col = getattr(OperatingTime, col)
        order = order_col.desc() if descending else order_col.asc()
        weekday_order = case(
            {d: i for i, d in enumerate(_WEEKDAY_ORDER, start=1)},
            value=OperatingTime.weekday,
        )
        rows = await self._session.execute(
            select(OperatingTime)
            .where(*where)
            .order_by(order, weekday_order)
            .limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        weekday: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> int:
        where = self._agent_where(
            center_id,
            ids=ids,
            weekday=weekday,
            date_from=date_from,
            date_to=date_to,
        )
        count = await self._session.scalar(
            select(func.count()).select_from(OperatingTime).where(*where)
        )
        return count or 0
