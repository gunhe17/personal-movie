from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class GetAssessmentSessionsByIdsService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(
        self,
        ids: list[str],
        center_id: str,
    ) -> list[AssessmentSession]:
        return await self.repo.list_by_ids(ids=ids, center_id=center_id)
