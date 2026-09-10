from datetime import datetime, time

from ..events import MemberNonWorkingTimeAtomic
from ..repository import MemberNonWorkingTimeRepository
from ..models import MemberNonWorkingTime
from app.core.datetime_utils import utc_now


class CreateMemberNonWorkingTimeService:
    def __init__(self, non_working_time_repo: MemberNonWorkingTimeRepository):
        self.non_working_time_repo = non_working_time_repo

    async def execute(
        self,
        *,
        member_id: str,
        center_id: str,
        reason: str,
        year: int | None = None,
        month: int | None = None,
        day: int | None = None,
        month_week: int | None = None,
        weekday: str | None = None,
        start_time: time | None = None,
        end_time: time | None = None,
        effective_from: datetime | None = None,
        effective_to: datetime | None = None,
        description: str | None = None,
    ) -> tuple[MemberNonWorkingTimeAtomic, MemberNonWorkingTime]:
        # return
        record = await self.non_working_time_repo.add(
            center_id=center_id,
            member_id=member_id,
            reason=reason,
            year=year,
            month=month,
            day=day,
            month_week=month_week,
            weekday=weekday,
            start_time=start_time,
            end_time=end_time,
            effective_from=effective_from if effective_from is not None else utc_now(),
            effective_to=effective_to,
            description=description,
        )
        return MemberNonWorkingTimeAtomic.created(non_working_time=record)
