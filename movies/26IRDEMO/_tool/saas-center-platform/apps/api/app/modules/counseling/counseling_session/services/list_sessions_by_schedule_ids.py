from ..repository import CounselingSessionRepository
from ..models import CounselingSession


class ListSessionsByScheduleIdsService:
    def __init__(self, repo: CounselingSessionRepository):
        self.repo = repo

    async def execute(self, schedule_ids: list[str]) -> list[CounselingSession]:
        if not schedule_ids:
            return []

        return await self.repo.list_by_schedule_ids(schedule_ids=schedule_ids)
