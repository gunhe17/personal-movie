from ..repository import CounselingNoteRepository
from ..models import CounselingNote


class GetNoteByIdService:
    def __init__(self, note_repo: CounselingNoteRepository):
        self.note_repo = note_repo

    async def execute(
        self,
        note_id: str,
        center_id: str
    ) -> CounselingNote:
        # load
        note = await self.note_repo.get_in_center(note_id=note_id, center_id=center_id)

        return note
