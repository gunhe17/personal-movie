from app.modules.assessment.assessment.models import Assessment
from app.modules.platform_admin.center_assessment.repository import AdminCenterAssessmentRepository


class ListUnassignedService:
    def __init__(self, repo: AdminCenterAssessmentRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        search: str | None = None,
    ) -> list[Assessment]:
        return await self.repo.list_unassigned_assessments(center_id, search=search)
