from ..repository import FieldNoteRepository
from ..models import FieldNote
from ..events import FieldNoteAtomic


class DeleteFieldNoteService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        # verify
        await self.repo.get_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )

        # return
        field_note = await self.repo.remove_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )
        assert field_note is not None
        return FieldNoteAtomic.deleted(field_note=field_note)
