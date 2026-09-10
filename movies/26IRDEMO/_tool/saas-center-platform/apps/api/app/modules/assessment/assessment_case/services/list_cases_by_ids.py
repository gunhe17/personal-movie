from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class ListCasesByIdsService:
    def __init__(self, repo: AssessmentCaseRepository):
        self.repo = repo

    async def execute(self, case_ids: list[str]) -> list[AssessmentCase]:
        if not case_ids:
            return []

        return await self.repo.list_by_ids(case_ids=case_ids)
