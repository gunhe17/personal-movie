from ..repository import CounselingNoteRepository
from ..models import CounselingNote


class GetNoteService:
    def __init__(self, note_repo: CounselingNoteRepository):
        self.note_repo = note_repo

    async def execute(
        self,
        session_id: str,
        client_id: str,
        center_id: str
    ) -> CounselingNote:
        # load
        note = await self.note_repo.get_by_session_and_client(
            session_id=session_id,
            client_id=client_id,
            center_id=center_id,
        )

        return note
