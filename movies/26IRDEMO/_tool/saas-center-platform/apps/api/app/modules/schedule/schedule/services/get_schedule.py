from ..models import Schedule
from ..repository import ScheduleRepository


class GetScheduleService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(self, schedule_id: str, center_id: str) -> Schedule:
        return await self.repo.get_in_center(id=schedule_id, center_id=center_id)
