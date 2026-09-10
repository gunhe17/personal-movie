from ..models import CounselingNoteAiDraft
from ..repository import CounselingNoteAiDraftRepository


class ListDraftsBySessionService:
    def __init__(self, repo: CounselingNoteAiDraftRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        session_id: str,
        center_id: str,
    ) -> list[CounselingNoteAiDraft]:
        # return
        return await self.repo.list_by_session(
            session_id=session_id,
            center_id=center_id,
        )
