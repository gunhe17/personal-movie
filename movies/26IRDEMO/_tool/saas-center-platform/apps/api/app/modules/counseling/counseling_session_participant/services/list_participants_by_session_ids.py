from ..repository import CounselingSessionParticipantRepository
from ..models import CounselingSessionParticipant


class ListParticipantsBySessionIdsService:
    def __init__(self, repo: CounselingSessionParticipantRepository):
        self.repo = repo

    async def execute(self, session_ids: list[str]) -> list[CounselingSessionParticipant]:
        if not session_ids:
            return []

        return await self.repo.list_by_session_ids(session_ids=session_ids)
