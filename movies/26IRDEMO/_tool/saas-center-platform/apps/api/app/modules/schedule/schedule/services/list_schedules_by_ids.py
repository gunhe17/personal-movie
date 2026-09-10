from ..models import Schedule
from ..repository import ScheduleRepository


class ListSchedulesByIdsService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(self, schedule_ids: list[str]) -> list[Schedule]:
        return await self.repo.list_by_ids(schedule_ids)
