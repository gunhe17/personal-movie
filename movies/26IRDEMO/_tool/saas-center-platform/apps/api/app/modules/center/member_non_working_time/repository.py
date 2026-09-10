from datetime import date, time

from sqlalchemy import and_, select

from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import MemberNonWorkingTime


class MemberNonWorkingTimeRepository(PostgresRepository[MemberNonWorkingTime]):
    model = MemberNonWorkingTime

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        member_id: uuid_str,
        reason: str,
        effective_from: utc_dt,
        effective_to: utc_dt | None = None,
        year: int | None = None,
        month: int | None = None,
        day: int | None = None,
        month_week: int | None = None,
        weekday: str | None = None,
        start_time: time | None = None,
        end_time: time | None = None,
        description: str | None = None,
    ) -> MemberNonWorkingTime:
        return await super().add(
            MemberNonWorkingTime(
                center_id=center_id,
                member_id=member_id,
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
                description=description,
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
        description: str | None = unset,
    ) -> MemberNonWorkingTime | None:
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
            description=description,
        )

    # #
    # query

    @typecheck
    async def get_by_member(
        self,
        non_working_time_id: uuid_str,
        member_id: uuid_str,
    ) -> MemberNonWorkingTime:
        non_working_time = await self._find(
            where=[
                MemberNonWorkingTime.id == non_working_time_id,
                MemberNonWorkingTime.member_id == member_id,
            ]
        )
        if non_working_time is None:
            raise EntityNotFoundException(
                f"비근무시간을 찾을 수 없습니다: {non_working_time_id}"
            )
        return non_working_time

    @typecheck
    async def list_by_member(
        self,
        member_id: uuid_str,
        year: int | None = None,
        reason: str | None = None,
        month: int | None = None,
        day: int | None = None,
        weekday: str | None = None,
        effective_from: utc_dt | None = None,
        effective_to: utc_dt | None = None,
        description: str | None = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[MemberNonWorkingTime]:
        conditions = self._build_nwt_filters(
            member_id=member_id,
            year=year,
            reason=reason,
            month=month,
            day=day,
            weekday=weekday,
            effective_from=effective_from,
            effective_to=effective_to,
            description=description,
        )

        query = (
            select(MemberNonWorkingTime)
            .where(and_(*conditions))
            .offset(skip)
            .limit(limit)
            .order_by(MemberNonWorkingTime.effective_from.desc())
        )
        return await self._scalars(query)

    @typecheck
    async def count_by_member(
        self,
        member_id: uuid_str,
        year: int | None = None,
        reason: str | None = None,
        month: int | None = None,
        day: int | None = None,
        weekday: str | None = None,
        effective_from: utc_dt | None = None,
        effective_to: utc_dt | None = None,
        description: str | None = None,
    ) -> int:
        conditions = self._build_nwt_filters(
            member_id=member_id,
            year=year,
            reason=reason,
            month=month,
            day=day,
            weekday=weekday,
            effective_from=effective_from,
            effective_to=effective_to,
            description=description,
        )

        return await self._count(where=conditions)

    @typecheck
    async def list_matching_by_date(
        self,
        member_id: uuid_str,
        target_date: date,
    ) -> list[MemberNonWorkingTime]:
        now = utc_now()
        weekday = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")[target_date.weekday()]
        week_of_month = (target_date.day - 1) // 7 + 1

        query = (
            select(MemberNonWorkingTime)
            .where(
                MemberNonWorkingTime.deleted_at.is_(None),
                MemberNonWorkingTime.member_id == member_id,
                MemberNonWorkingTime.effective_from <= now,
                (MemberNonWorkingTime.effective_to.is_(None))
                | (MemberNonWorkingTime.effective_to >= now),
                (MemberNonWorkingTime.year.is_(None))
                | (MemberNonWorkingTime.year == target_date.year),
                (MemberNonWorkingTime.month.is_(None))
                | (MemberNonWorkingTime.month == target_date.month),
                (MemberNonWorkingTime.day.is_(None))
                | (MemberNonWorkingTime.day == target_date.day),
                (MemberNonWorkingTime.weekday.is_(None))
                | (MemberNonWorkingTime.weekday == weekday),
                (MemberNonWorkingTime.month_week.is_(None))
                | (MemberNonWorkingTime.month_week == week_of_month),
            )
        )
        return await self._scalars(query)

    # #
    # helpers

    @staticmethod
    def _build_nwt_filters(
        member_id: uuid_str,
        year: int | None = None,
        reason: str | None = None,
        month: int | None = None,
        day: int | None = None,
        weekday: str | None = None,
        effective_from: utc_dt | None = None,
        effective_to: utc_dt | None = None,
        description: str | None = None,
    ):
        conditions = [
            MemberNonWorkingTime.deleted_at.is_(None),
            MemberNonWorkingTime.member_id == member_id,
        ]

        if year is not None:
            conditions.append(MemberNonWorkingTime.year == year)

        if reason is not None:
            conditions.append(MemberNonWorkingTime.reason == reason)

        if month is not None:
            conditions.append(MemberNonWorkingTime.month == month)

        if day is not None:
            conditions.append(MemberNonWorkingTime.day == day)

        if weekday is not None:
            conditions.append(MemberNonWorkingTime.weekday == weekday)

        if effective_from is not None:
            conditions.append(MemberNonWorkingTime.effective_from >= effective_from)

        if effective_to is not None:
            conditions.append(
                (MemberNonWorkingTime.effective_to.is_(None))
                | (MemberNonWorkingTime.effective_to <= effective_to)
            )

        if description is not None:
            conditions.append(MemberNonWorkingTime.description.ilike(f"%{description}%"))

        return conditions
