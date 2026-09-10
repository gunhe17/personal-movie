from ..repository import CounselingCaseRepository
from ..models import CounselingCase


class ListCasesByIdsService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(self, case_ids: list[str]) -> list[CounselingCase]:
        if not case_ids:
            return []

        return await self.repo.list_by_ids(case_ids=case_ids)
