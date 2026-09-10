from datetime import date, datetime, time

from sqlalchemy import and_, case, delete, func, or_, select

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import MemberWorkingTime


_WEEKDAY_ORDER = case(
    {"MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 7},
    value=MemberWorkingTime.weekday,
)


class MemberWorkingTimeRepository(PostgresRepository[MemberWorkingTime]):
    model = MemberWorkingTime

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        member_id: uuid_str,
        weekday: str,
        start_time: time | None = None,
        end_time: time | None = None,
        break_start_time: time | None = None,
        break_end_time: time | None = None,
    ) -> MemberWorkingTime:
        return await super().add(
            MemberWorkingTime(
                center_id=center_id,
                member_id=member_id,
                weekday=weekday,
                start_time=start_time,
                end_time=end_time,
                break_start_time=break_start_time,
                break_end_time=break_end_time,
            )
        )

    @typecheck
    async def hard_delete_by_member(self, member_id: uuid_str) -> int:
        # 물리 DELETE 의도적: bulk_update_working_times 가 전건 삭제 후 재삽입(replace).
        # soft-delete면 (member_id, weekday) 재삽입 시 삭제행과 누적·충돌.
        result = await self._session.execute(
            delete(MemberWorkingTime).where(MemberWorkingTime.member_id == member_id)
        )
        return result.rowcount

    # #
    # query

    @typecheck
    async def list_by_member(
        self,
        member_id: uuid_str,
        weekday: str | None = None,
        is_working_day: bool | None = None,
    ) -> list[MemberWorkingTime]:
        conditions = [
            MemberWorkingTime.deleted_at.is_(None),
            MemberWorkingTime.member_id == member_id,
        ]

        if weekday is not None:
            conditions.append(MemberWorkingTime.weekday == weekday)

        if is_working_day is True:
            conditions.append(MemberWorkingTime.start_time.is_not(None))
            conditions.append(MemberWorkingTime.end_time.is_not(None))
        elif is_working_day is False:
            conditions.append(
                or_(
                    MemberWorkingTime.start_time.is_(None),
                    MemberWorkingTime.end_time.is_(None),
                )
            )

        query = (
            select(MemberWorkingTime)
            .where(and_(*conditions))
            .order_by(_WEEKDAY_ORDER)
        )
        return await self._scalars(query)

    @typecheck
    async def list_by_center(
        self,
        center_id: uuid_str,
        weekday: str | None = None,
        is_working_day: bool | None = None,
    ) -> list[MemberWorkingTime]:
        conditions = [
            MemberWorkingTime.deleted_at.is_(None),
            MemberWorkingTime.center_id == center_id,
        ]
        if weekday is not None:
            conditions.append(MemberWorkingTime.weekday == weekday)
        if is_working_day is True:
            conditions.append(MemberWorkingTime.start_time.is_not(None))
            conditions.append(MemberWorkingTime.end_time.is_not(None))
        elif is_working_day is False:
            conditions.append(
                or_(
                    MemberWorkingTime.start_time.is_(None),
                    MemberWorkingTime.end_time.is_(None),
                )
            )

        query = (
            select(MemberWorkingTime)
            .where(and_(*conditions))
            .order_by(MemberWorkingTime.member_id, _WEEKDAY_ORDER)
        )
        return await self._scalars(query)

    @typecheck
    async def find_by_weekday(
        self,
        member_id: uuid_str,
        weekday: str,
    ) -> MemberWorkingTime | None:
        query = select(MemberWorkingTime).where(
            MemberWorkingTime.deleted_at.is_(None),
            MemberWorkingTime.member_id == member_id,
            MemberWorkingTime.weekday == weekday,
        )
        items = await self._scalars(query)
        return items[0] if items else None

    @typecheck
    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        member_id: str | None = None,
        member_ids: list[str] | None = None,
        weekday: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list:
        where = [
            MemberWorkingTime.center_id == center_id,
            MemberWorkingTime.deleted_at.is_(None),
        ]
        if ids:
            where.append(MemberWorkingTime.id.in_(ids))
        mid_set = set(member_ids or [])
        if member_id:
            mid_set.add(member_id)
        if mid_set:
            where.append(MemberWorkingTime.member_id.in_(mid_set))
        if weekday:
            where.append(MemberWorkingTime.weekday == weekday)
        if date_from:
            where.append(MemberWorkingTime.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(MemberWorkingTime.created_at <= datetime.combine(date_to, time.max))
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        ids: list[str] | None = None,
        member_id: str | None = None,
        member_ids: list[str] | None = None,
        weekday: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[MemberWorkingTime]:
        where = self._agent_where(
            center_id,
            ids=ids,
            member_id=member_id,
            member_ids=member_ids,
            weekday=weekday,
            date_from=date_from,
            date_to=date_to,
        )
        col, descending = resolve_sort(sort)
        order_col = getattr(MemberWorkingTime, col)
        order = order_col.desc() if descending else order_col.asc()
        rows = await self._session.execute(
            select(MemberWorkingTime)
            .where(*where)
            .order_by(order, MemberWorkingTime.member_id, _WEEKDAY_ORDER)
            .limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        member_id: str | None = None,
        member_ids: list[str] | None = None,
        weekday: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> int:
        where = self._agent_where(
            center_id,
            ids=ids,
            member_id=member_id,
            member_ids=member_ids,
            weekday=weekday,
            date_from=date_from,
            date_to=date_to,
        )
        count = await self._session.scalar(
            select(func.count()).select_from(MemberWorkingTime).where(*where)
        )
        return count or 0
