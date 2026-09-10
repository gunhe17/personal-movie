from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class FindSessionByIdService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(self, session_id: str) -> AssessmentSession | None:
        return await self.repo.find_by_id(id=session_id)
