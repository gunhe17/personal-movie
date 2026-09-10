from ..repository import AssessmentSetRepository
from ..models import AssessmentSet


class GetAssessmentSetService:
    def __init__(self, repo: AssessmentSetRepository):
        self.repo = repo

    async def execute(self, center_id: str, set_id: str) -> AssessmentSet:
        assessment_set = await self.repo.get_in_center(center_id=center_id, set_id=set_id)

        return assessment_set
