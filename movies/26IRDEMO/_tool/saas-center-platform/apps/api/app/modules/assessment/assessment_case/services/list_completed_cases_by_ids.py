from ..models import AssessmentCase
from ..repository import AssessmentCaseRepository


class ListCompletedCasesByIdsService:
    def __init__(self, repo: AssessmentCaseRepository):
        self.repo = repo

    async def execute(self, case_ids: list[str]) -> list[AssessmentCase]:
        return await self.repo.list_completed_by_ids(case_ids=case_ids)
