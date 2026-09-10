import calendar
from datetime import datetime

from app.core.datetime_utils import utc_now


class ResolvePeriodService:
    def execute(
        self,
        *,
        year: int | None = None,
        month: int | None = None,
    ) -> tuple[datetime, datetime]:
        # compute
        now = utc_now()
        y = year or now.year
        m = month or now.month
        last_day = calendar.monthrange(y, m)[1]

        # return
        return datetime(y, m, 1), datetime(y, m, last_day, 23, 59, 59)
