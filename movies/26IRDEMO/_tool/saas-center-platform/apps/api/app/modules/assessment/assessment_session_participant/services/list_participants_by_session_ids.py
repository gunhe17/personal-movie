from ..repository import AssessmentSessionParticipantRepository
from ..models import AssessmentSessionParticipant


class ListParticipantsBySessionIdsService:
    def __init__(self, repo: AssessmentSessionParticipantRepository):
        self.repo = repo

    async def execute(self, session_ids: list[str]) -> list[AssessmentSessionParticipant]:
        if not session_ids:
            return []

        return await self.repo.list_by_session_ids(session_ids=session_ids)
