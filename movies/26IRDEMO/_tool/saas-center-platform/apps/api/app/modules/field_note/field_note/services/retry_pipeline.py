from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str

from ..events import FieldNoteAtomic
from ..repository import FieldNoteRepository
from ..models import FieldNote, FieldNotePipelineStep, FieldNoteProcessingStatus


class RetryPipelineService:
    def __init__(
        self,
        repo: FieldNoteRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        field_note_id: uuid_str,
        center_id: uuid_str,
    ) -> tuple[FieldNoteAtomic, FieldNote, str]:
        # load
        field_note = await self.repo.get_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )

        # verify
        if field_note.processing_status != "failed":
            raise InvalidOperationException("실패한 파이프라인만 재시도할 수 있습니다.")

        # compute — 구 어휘 failed_step(transcribe·diarization 등 어휘 통일 전 행)은 처음부터 재시작
        try:
            start_from = FieldNotePipelineStep(field_note.failed_step or "")
        except ValueError:
            start_from = FieldNotePipelineStep.TRANSCRIBING

        # mutate
        field_note = await self.repo.update_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
            processing_status=FieldNoteProcessingStatus.PROCESSING,
            processing_step=start_from,
            failed_step=None,
        )

        # return
        atomic, _ = FieldNoteAtomic.updated(
            field_note=field_note,
            changed={
                "processing_status": FieldNoteProcessingStatus.PROCESSING,
                "processing_step": start_from,
                "failed_step": None,
            },
        )
        return atomic, field_note, start_from
