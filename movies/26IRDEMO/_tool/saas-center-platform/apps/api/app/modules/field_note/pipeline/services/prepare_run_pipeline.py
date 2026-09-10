from app.core.type import uuid_str

from ...field_note.events import FieldNoteAtomic
from ...field_note.models import FieldNotePipelineStep, FieldNoteProcessingStatus
from ...field_note.repository import FieldNoteRepository
from .prepare_pipeline_step import StepResult


class PrepareRunPipelineService:
    def __init__(
        self,
        repo: FieldNoteRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        field_note_id: uuid_str,
        center_id: uuid_str,
    ) -> tuple[FieldNoteAtomic | None, StepResult, str | None]:
        # load
        field_note = await self.repo.get_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )

        # verify
        if field_note.status != "completed":
            return (
                None,
                StepResult(
                    "precondition_not_met",
                    "pipeline",
                    field_note_id,
                    "녹음이 완료된 필드노트만 파이프라인을 실행할 수 있습니다.",
                ),
                None,
            )
        if field_note.processing_status == "processing":
            return (
                None,
                StepResult(
                    "already_processing",
                    "pipeline",
                    field_note_id,
                    "이미 파이프라인이 진행 중입니다.",
                ),
                None,
            )

        # compute (완료된 스텝 다음부터 재개)
        start_from = FieldNotePipelineStep.TRANSCRIBING
        if field_note.transcribe_status == "completed":
            start_from = FieldNotePipelineStep.REFINING
        if field_note.refine_status == "completed":
            start_from = FieldNotePipelineStep.SUMMARIZING
        if field_note.summary_status == "completed":
            return (
                None,
                StepResult(
                    "already_completed",
                    "pipeline",
                    field_note_id,
                    "모든 파이프라인 스텝이 이미 완료되었습니다.",
                ),
                None,
            )

        # transition
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
        return (
            atomic,
            StepResult(
                "started",
                "pipeline",
                field_note_id,
                f"파이프라인을 {start_from}부터 실행합니다.",
            ),
            start_from,
        )
