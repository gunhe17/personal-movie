from ..events import ScheduleAtomic
from ..models import Schedule
from ..repository import ScheduleRepository


class DeleteScheduleService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(self, schedule_id: str, center_id: str) -> tuple[ScheduleAtomic, Schedule]:
        # load
        schedule = await self.repo.get_in_center(id=schedule_id, center_id=center_id)

        # remove
        await self.repo.remove_by_id(schedule_id)

        # return
        return ScheduleAtomic.deleted(schedule=schedule)
