from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class GetAssessmentCaseService:
    def __init__(self, repo: AssessmentCaseRepository):
        self.repo = repo

    async def execute(self, center_id: str, case_id: str) -> AssessmentCase:
        # load
        case = await self.repo.get_in_center(center_id=center_id, case_id=case_id)

        return case
