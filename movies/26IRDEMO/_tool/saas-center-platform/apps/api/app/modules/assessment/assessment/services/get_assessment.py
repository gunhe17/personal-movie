from ..repository import AssessmentRepository
from ..models import Assessment


class GetAssessmentService:
    def __init__(self, repo: AssessmentRepository):
        self.repo = repo

    async def execute(self, assessment_id: str) -> Assessment:
        assessment = await self.repo.get_by_id(assessment_id)

        return assessment
