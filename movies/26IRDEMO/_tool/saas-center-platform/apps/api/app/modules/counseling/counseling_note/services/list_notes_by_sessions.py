from ..repository import CounselingNoteRepository
from ..models import CounselingNote


class ListNotesBySessionsService:
    def __init__(self, repo: CounselingNoteRepository):
        self.repo = repo

    async def execute(
        self,
        session_ids: list[str],
        center_id: str,
    ) -> list[CounselingNote]:
        return await self.repo.list_by_sessions(session_ids=session_ids, center_id=center_id)
