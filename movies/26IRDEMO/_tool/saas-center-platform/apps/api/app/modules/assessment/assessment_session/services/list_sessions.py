from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class ListSessionsService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(self, case_id: str) -> list[AssessmentSession]:
        sessions = await self.repo.list_by_case(case_id=case_id)
        return sessions
