from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class ListSessionsByCaseIdsService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(self, case_ids: list[str]) -> list[AssessmentSession]:
        if not case_ids:
            return []

        return await self.repo.list_by_case_ids(case_ids=case_ids)
