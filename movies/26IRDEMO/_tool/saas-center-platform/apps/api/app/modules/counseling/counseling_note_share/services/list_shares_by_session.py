from ..models import CounselingNoteShare
from ..repository import CounselingNoteShareRepository


class ListSharesBySessionService:
    def __init__(self, repo: CounselingNoteShareRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        session_id: str,
        center_id: str,
    ) -> list[CounselingNoteShare]:
        return await self.repo.list_by_session(session_id=session_id, center_id=center_id)
