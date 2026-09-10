from ..models import CounselingSession
from ..repository import CounselingSessionRepository


class ListCompletedSessionsByCaseIdsService:
    def __init__(self, repo: CounselingSessionRepository):
        self.repo = repo

    async def execute(self, case_ids: list[str]) -> list[CounselingSession]:
        return await self.repo.list_completed_by_case_ids(case_ids=case_ids)
