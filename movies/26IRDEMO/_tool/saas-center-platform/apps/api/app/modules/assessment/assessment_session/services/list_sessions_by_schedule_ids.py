from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class ListSessionsByScheduleIdsService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(self, schedule_ids: list[str]) -> list[AssessmentSession]:
        if not schedule_ids:
            return []

        return await self.repo.list_by_schedule_ids(schedule_ids=schedule_ids)
