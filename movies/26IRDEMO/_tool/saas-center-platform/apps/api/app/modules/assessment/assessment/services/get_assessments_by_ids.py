from ..repository import AssessmentRepository
from ..models import Assessment


class GetAssessmentsByIdsService:
    def __init__(self, repo: AssessmentRepository):
        self.repo = repo

    async def execute(self, assessment_ids: list[str]) -> list[Assessment]:
        if not assessment_ids:
            return []

        return await self.repo.list_by_ids(ids=assessment_ids)
