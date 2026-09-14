from ..models import CounselingNoteDerivation
from ..repository import CounselingNoteDerivationRepository


class ListDerivationsService:
    def __init__(self, repo: CounselingNoteDerivationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        session_id: str,
        center_id: str,
    ) -> list[CounselingNoteDerivation]:
        return await self.repo.list_by_session(
            counseling_session_id=session_id,
            center_id=center_id,
        )
