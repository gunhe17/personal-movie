from ...field_note.events import FieldNoteAtomic
from ...field_note.models import FieldNote
from ...field_note.repository import FieldNoteRepository


class UpdateFieldNoteStatusesService:
    def __init__(
        self,
        note_repo: FieldNoteRepository,
    ):
        self.repo = note_repo

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
        **fields,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        # mutate
        field_note = await self.repo.update_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
            **fields,
        )

        # return
        return FieldNoteAtomic.updated(
            field_note=field_note,
            changed=dict(fields),
        )
