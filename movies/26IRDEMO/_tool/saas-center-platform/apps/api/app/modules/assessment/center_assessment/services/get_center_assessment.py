from ..repository import CenterAssessmentRepository
from ..models import CenterAssessment


class GetCenterAssessmentService:
    def __init__(self, repo: CenterAssessmentRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        assessment_id: str,
    ) -> CenterAssessment:
        return await self.repo.get_in_center(
            center_id=center_id,
            assessment_id=assessment_id,
        )
