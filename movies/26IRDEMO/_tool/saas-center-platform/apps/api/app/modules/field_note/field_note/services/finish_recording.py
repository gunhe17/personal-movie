from app.core.type import unset, uuid_str

from ..events import FieldNoteAtomic
from ..repository import FieldNoteRepository
from ..models import FieldNote, FieldNoteStatus


class FinishRecordingService:
    def __init__(
        self,
        repo: FieldNoteRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        field_note_id: uuid_str,
        center_id: uuid_str,
        *,
        total_duration: float,
        note_template_type: str | None = unset,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        # verify
        await self.repo.get_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )

        # mutate
        field_note = await self.repo.update_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
            status=FieldNoteStatus.COMPLETED,
            total_duration=total_duration,
            note_template_type=note_template_type,
        )

        # return
        changed = {
            "status": FieldNoteStatus.COMPLETED,
            "total_duration": total_duration,
        }
        if note_template_type is not unset:
            changed["note_template_type"] = note_template_type
        return FieldNoteAtomic.updated(field_note=field_note, changed=changed)
