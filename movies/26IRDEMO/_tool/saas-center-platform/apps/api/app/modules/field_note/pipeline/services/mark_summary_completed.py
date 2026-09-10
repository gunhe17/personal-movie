import json
from app.core.datetime_utils import utc_now

from app.core.type import unset

from ...field_note.events import FieldNoteAtomic
from ...field_note.models import FieldNote, FieldNoteSummaryStatus
from ...field_note.repository import FieldNoteRepository


class MarkSummaryCompletedService:
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
        summary_text: str,
        model: str,
        analysis_json: str | None = None,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        # mutate
        field_note = await self.repo.update_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
            summary=summary_text,
            analysis=analysis_json if analysis_json is not None else unset,
            summary_status=FieldNoteSummaryStatus.COMPLETED,
            summary_generated_at=utc_now(),
            summary_model=model,
        )

        # return (요약 본문은 민감값 — changed 에서 제외)
        return FieldNoteAtomic.updated(
            field_note=field_note,
            changed={
                "summary_status": FieldNoteSummaryStatus.COMPLETED,
                "summary_model": model,
            },
        )
