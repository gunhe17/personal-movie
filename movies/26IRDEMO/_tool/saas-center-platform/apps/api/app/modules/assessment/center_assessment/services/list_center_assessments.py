from ..repository import CenterAssessmentRepository
from ..models import CenterAssessment


class ListCenterAssessmentsService:
    def __init__(self, repo: CenterAssessmentRepository):
        self.repo = repo

    async def execute(
        self, center_id: str, is_active: bool | None = None
    ) -> list[CenterAssessment]:
        return await self.repo.list_in_center(center_id=center_id, is_active=is_active)
