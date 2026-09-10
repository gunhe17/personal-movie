from app.core.type import uuid_str

from ..events import FieldNoteAtomic
from ..repository import FieldNoteRepository
from ..models import FieldNote, FieldNoteProcessingStatus


class SkipPipelineService:
    def __init__(
        self,
        repo: FieldNoteRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        field_note_id: uuid_str,
        center_id: uuid_str,
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
            processing_status=FieldNoteProcessingStatus.SKIPPED,
            processing_step=None,
            failed_step=None,
        )

        # return
        return FieldNoteAtomic.updated(
            field_note=field_note,
            changed={
                "processing_status": FieldNoteProcessingStatus.SKIPPED,
                "processing_step": None,
                "failed_step": None,
            },
        )
