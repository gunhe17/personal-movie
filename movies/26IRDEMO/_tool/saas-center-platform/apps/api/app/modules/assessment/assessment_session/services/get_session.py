from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class GetSessionService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(self, center_id: str, session_id: str) -> AssessmentSession:
        # load
        return await self.repo.get_in_center(center_id=center_id, session_id=session_id)
