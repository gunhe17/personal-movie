from ..models import ScheduleChangeRequest
from ..repository import ScheduleChangeRequestRepository


class ListPendingBySchedulesService:
    def __init__(self, repo: ScheduleChangeRequestRepository):
        self.repo = repo

    async def execute(self, *, schedule_ids: list[str]) -> list[ScheduleChangeRequest]:
        return await self.repo.list_pending_by_schedule_ids(schedule_ids=schedule_ids)
