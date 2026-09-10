from datetime import datetime

from ..models import Schedule
from ..repository import ScheduleRepository


class ListSchedulesStartingInRangeService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(
        self,
        start_utc: datetime,
        end_utc: datetime,
        schedule_types: list[str],
    ) -> list[Schedule]:
        if not schedule_types:
            return []

        return await self.repo.list_starting_in_range_all_centers(
            start_utc=start_utc,
            end_utc=end_utc,
            schedule_types=schedule_types,
        )
