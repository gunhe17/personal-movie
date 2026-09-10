from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class FindAssessmentCaseService:
    def __init__(self, repo: AssessmentCaseRepository):
        self.repo = repo

    async def execute(self, case_id: str) -> AssessmentCase | None:
        # return
        return await self.repo.find_by_id(id=case_id)
