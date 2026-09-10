from datetime import datetime, time

from ..events import NonOperatingTimeAtomic
from ..repository import NonOperatingTimeRepository
from ..models import NonOperatingTime
from app.core.datetime_utils import utc_now


class CreateNonOperatingTimeService:
    def __init__(self, repo: NonOperatingTimeRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        year: int | None,
        month: int | None,
        day: int | None,
        month_week: int | None,
        weekday: str | None,
        start_time: time | None,
        end_time: time | None,
        effective_from: datetime | None,
        effective_to: datetime | None,
        reason: str,
        confirm: bool,
        created_by: str | None = None,
    ) -> tuple[NonOperatingTimeAtomic, NonOperatingTime]:
        # default
        if effective_from is None:
            effective_from = utc_now()

        # return
        record = await self.repo.add(
            center_id=center_id,
            year=year,
            month=month,
            day=day,
            month_week=month_week,
            weekday=weekday,
            start_time=start_time,
            end_time=end_time,
            effective_from=effective_from,
            effective_to=effective_to,
            reason=reason,
            created_by=created_by,
        )
        return NonOperatingTimeAtomic.created(non_op=record)
