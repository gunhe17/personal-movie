from datetime import date, time

from sqlalchemy import select

from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import NonOperatingTime


class NonOperatingTimeRepository(PostgresRepository[NonOperatingTime]):
    model = NonOperatingTime

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        reason: str,
        created_by: str | None,
        effective_from: utc_dt,
        effective_to: utc_dt | None = None,
        year: int | None = None,
        month: int | None = None,
        day: int | None = None,
        month_week: int | None = None,
        weekday: str | None = None,
        start_time: time | None = None,
        end_time: time | None = None,
        is_system_registered: bool = False,
    ) -> NonOperatingTime:
        return await super().add(
            NonOperatingTime(
                center_id=center_id,
                reason=reason,
                created_by=created_by,
                is_system_registered=is_system_registered,
                effective_from=effective_from,
                effective_to=effective_to,
                year=year,
                month=month,
                day=day,
                month_week=month_week,
                weekday=weekday,
                start_time=start_time,
                end_time=end_time,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        reason: str = unset,
        effective_from: utc_dt = unset,
        effective_to: utc_dt | None = unset,
        year: int | None = unset,
        month: int | None = unset,
        day: int | None = unset,
        month_week: int | None = unset,
        weekday: str | None = unset,
        start_time: time | None = unset,
        end_time: time | None = unset,
    ) -> NonOperatingTime | None:
        return await self.update_fields(
            id,
            reason=reason,
            effective_from=effective_from,
            effective_to=effective_to,
            year=year,
            month=month,
            day=day,
            month_week=month_week,
            weekday=weekday,
            start_time=start_time,
            end_time=end_time,
        )

    # #
    # query

    @typecheck
    async def get_in_center(
        self,
        non_operating_time_id: uuid_str,
        center_id: uuid_str,
    ) -> NonOperatingTime:
        non_op = await self._find(
            where=[
                NonOperatingTime.id == non_operating_time_id,
                NonOperatingTime.center_id == center_id,
            ]
        )
        if non_op is None:
            raise EntityNotFoundException(f"비영업시간을 찾을 수 없습니다: {non_operating_time_id}")
        return non_op

    @typecheck
    async def list_by_center(
        self,
        center_id: uuid_str,
        active_only: bool = False,
        reason: str | None = None,
        year: int | None = None,
        month: int | None = None,
        created_by: str | None = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[NonOperatingTime]:
        where = [NonOperatingTime.center_id == center_id]
        if active_only:
            now = utc_now()
            where.append(NonOperatingTime.effective_from <= now)
            where.append(
                (NonOperatingTime.effective_to.is_(None))
                | (NonOperatingTime.effective_to >= now)
            )
        if reason is not None:
            where.append(NonOperatingTime.reason.ilike(f"%{reason}%"))
        if year is not None:
            where.append(NonOperatingTime.year == year)
        if month is not None:
            where.append(NonOperatingTime.month == month)
        if created_by is not None:
            where.append(NonOperatingTime.created_by == created_by)
        return await self._filter(
            where=where,
            order_by="effective_from",
            descending=True,
            limit=limit,
            offset=skip,
        )

    @typecheck
    async def list_active_by_center(
        self,
        center_id: uuid_str,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[NonOperatingTime]:
        now = utc_now()
        return await self._filter(
            where=[
                NonOperatingTime.center_id == center_id,
                NonOperatingTime.effective_from <= now,
                (NonOperatingTime.effective_to.is_(None))
                | (NonOperatingTime.effective_to >= now),
            ],
            order_by="effective_from",
            descending=True,
            limit=limit,
            offset=skip,
        )

    @typecheck
    async def count_by_center(self, center_id: uuid_str) -> int:
        return await self._count(where=[NonOperatingTime.center_id == center_id])

    @typecheck
    async def list_system_created(
        self,
        center_id: uuid_str,
        year: int | None = None,
    ) -> list[NonOperatingTime]:
        query = select(NonOperatingTime).where(
            NonOperatingTime.deleted_at.is_(None),
            NonOperatingTime.center_id == center_id,
            NonOperatingTime.is_system_registered.is_(True),
        )
        if year:
            query = query.where(NonOperatingTime.year == year)
        return await self._scalars(query)

    @typecheck
    async def list_matching_by_date(
        self,
        center_id: uuid_str,
        target_date: date,
    ) -> list[NonOperatingTime]:
        now = utc_now()
        weekday = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")[target_date.weekday()]
        week_of_month = (target_date.day - 1) // 7 + 1

        return await self._filter(
            where=[
                NonOperatingTime.center_id == center_id,
                NonOperatingTime.effective_from <= now,
                (NonOperatingTime.effective_to.is_(None))
                | (NonOperatingTime.effective_to >= now),
                (NonOperatingTime.year.is_(None))
                | (NonOperatingTime.year == target_date.year),
                (NonOperatingTime.month.is_(None))
                | (NonOperatingTime.month == target_date.month),
                (NonOperatingTime.day.is_(None))
                | (NonOperatingTime.day == target_date.day),
                (NonOperatingTime.weekday.is_(None))
                | (NonOperatingTime.weekday == weekday),
                (NonOperatingTime.month_week.is_(None))
                | (NonOperatingTime.month_week == week_of_month),
            ]
        )
