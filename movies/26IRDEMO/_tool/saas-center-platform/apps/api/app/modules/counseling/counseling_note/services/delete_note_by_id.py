from ..events import CounselingNoteAtomic
from ..models import CounselingNote
from ..repository import CounselingNoteRepository


class DeleteNoteByIdService:
    def __init__(self, note_repo: CounselingNoteRepository):
        self.note_repo = note_repo

    async def execute(
        self,
        note_id: str,
        center_id: str
    ) -> tuple[CounselingNoteAtomic, CounselingNote]:
        # load
        note = await self.note_repo.get_in_center(note_id=note_id, center_id=center_id)

        # remove
        await self.note_repo.remove_by_id(id=note.id)

        return CounselingNoteAtomic.deleted(note=note)
