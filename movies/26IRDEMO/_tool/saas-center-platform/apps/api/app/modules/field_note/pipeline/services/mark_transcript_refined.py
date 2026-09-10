from ...field_note.events import FieldNoteAtomic
from ...field_note.models import FieldNote
from ...field_note.repository import FieldNoteRepository


class MarkTranscriptRefinedService:
    def __init__(
        self,
        note_repo: FieldNoteRepository,
    ):
        self.repo = note_repo

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
        *,
        refined_json: str,
        model: str | None,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        # mutate
        field_note = await self.repo.update_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
            refined_transcript=refined_json,
            refinement_model=model,
        )

        # return (보정 전사 본문은 민감값 — changed 에서 제외)
        return FieldNoteAtomic.updated(
            field_note=field_note,
            changed={"refinement_model": model},
        )
