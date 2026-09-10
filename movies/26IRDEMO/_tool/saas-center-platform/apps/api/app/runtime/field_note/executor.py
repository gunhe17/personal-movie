# field_note 파이프라인 worker executor — JOB_HANDLERS 등록 대상.
# Track B leaf: 워커가 uow 미주입 호출이라 자체 세션이 구조 필수(runner가 소유).
# 스텝 상태 전이는 runner, DB는 PipelineFacade, AI는 AIFacade, 파일은 storage.
from app.behavior.action.event import Event
from app.core.logger import get_logger
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.storage import get_storage_client
from app.modules.field_note.facade import (
    FieldNoteDiarizationStatus,
    FieldNoteNoteStatus,
    FieldNotePipelineStep,
    FieldNoteProcessingStatus,
    FieldNoteRefineStatus,
    FieldNoteSummaryStatus,
    FieldNoteTranscribeStatus,
    PipelineFacade,
)
from app.modules.llm.facade.ai_facade import create_ai_facade

from .counseling_note.service import GenerateCounselingNoteService
from .diarize.service import DiarizeTranscriptService
from .refine.service import RefineTranscriptService
from .runner import PipelineRunner, StepBinding
from .summary.service import SummarizeFieldNoteService
from .transcribe.chunk import transcribe_chunk
from .transcribe.service import TranscribeAudioService

logger = get_logger(__name__)

_TRANSCRIBE = StepBinding(
    status_field="transcribe_status",
    completed=FieldNoteTranscribeStatus.COMPLETED,
    failed=FieldNoteTranscribeStatus.FAILED,
    step=FieldNotePipelineStep.TRANSCRIBING,
)
_DIARIZE = StepBinding(
    status_field="diarization_status",
    completed=FieldNoteDiarizationStatus.COMPLETED,
    failed=FieldNoteDiarizationStatus.FAILED,
    step=FieldNotePipelineStep.DIARIZING,
)
_REFINE = StepBinding(
    status_field="refine_status",
    completed=FieldNoteRefineStatus.COMPLETED,
    failed=FieldNoteRefineStatus.FAILED,
    step=FieldNotePipelineStep.REFINING,
)
_SUMMARY = StepBinding(
    status_field="summary_status",
    completed=FieldNoteSummaryStatus.COMPLETED,
    failed=FieldNoteSummaryStatus.FAILED,
    step=FieldNotePipelineStep.SUMMARIZING,
)
_COUNSELING_NOTE = StepBinding(
    status_field="note_status",
    completed=FieldNoteNoteStatus.COMPLETED,
    failed=FieldNoteNoteStatus.FAILED,
    step=FieldNotePipelineStep.GENERATING_NOTE,
)

_PIPELINE_STEPS = [FieldNotePipelineStep.TRANSCRIBING, FieldNotePipelineStep.REFINING]


async def process_transcribe(
    field_note_id: str,
    center_id: str,
    *,
    standalone: bool = True,
    member_id: str | None = None,
) -> dict | None:
    runner = PipelineRunner(AsyncSessionLocal)
    ai = create_ai_facade()
    storage = get_storage_client()

    return await runner.run_step(
        field_note_id,
        center_id,
        _TRANSCRIBE,
        lambda uow: TranscribeAudioService(
            PipelineFacade(uow),
            ai=ai,
            storage=storage,
        ).execute(field_note_id, center_id, member_id=member_id),
        standalone=standalone,
        event_name="field_note_transcribed",
        actor_id=member_id,
    )


async def process_diarize(
    field_note_id: str,
    center_id: str,
    *,
    standalone: bool = True,
    member_id: str | None = None,
) -> dict | None:
    runner = PipelineRunner(AsyncSessionLocal)
    ai = create_ai_facade()
    storage = get_storage_client()

    return await runner.run_step(
        field_note_id,
        center_id,
        _DIARIZE,
        lambda uow: DiarizeTranscriptService(
            PipelineFacade(uow),
            ai=ai,
            storage=storage,
        ).execute(field_note_id, center_id, member_id=member_id),
        standalone=standalone,
        event_name="field_note_diarized",
        actor_id=member_id,
    )


async def process_refine(
    field_note_id: str,
    center_id: str,
    *,
    standalone: bool = True,
    member_id: str | None = None,
) -> list[dict] | None:
    runner = PipelineRunner(AsyncSessionLocal)
    ai = create_ai_facade()

    return await runner.run_step(
        field_note_id,
        center_id,
        _REFINE,
        lambda uow: RefineTranscriptService(
            PipelineFacade(uow),
            ai=ai,
        ).execute(field_note_id, center_id, member_id=member_id),
        standalone=standalone,
        event_name="field_note_refined",
        actor_id=member_id,
    )


async def process_summary(
    field_note_id: str,
    center_id: str,
    *,
    standalone: bool = True,
    member_id: str | None = None,
) -> str | None:
    runner = PipelineRunner(AsyncSessionLocal)
    ai = create_ai_facade()

    return await runner.run_step(
        field_note_id,
        center_id,
        _SUMMARY,
        lambda uow: SummarizeFieldNoteService(
            PipelineFacade(uow),
            ai=ai,
        ).execute(field_note_id, center_id, member_id=member_id),
        standalone=standalone,
        event_name="field_note_summarized",
        actor_id=member_id,
    )


async def process_counseling_note(
    field_note_id: str,
    center_id: str,
    session_id: str = "",
    client_ids: list[str] | None = None,
    author_id: str = "",
    transcript_text: str = "",
    entries_text: str = "",
    summary_text: str = "",
    total_duration: float = 0.0,
    note_template_type: str | None = None,
) -> None:
    runner = PipelineRunner(AsyncSessionLocal)
    ai = create_ai_facade()

    event_group_id = await runner.run_step(
        field_note_id,
        center_id,
        _COUNSELING_NOTE,
        lambda uow: GenerateCounselingNoteService(
            uow,
            ai=ai,
        ).execute(
            field_note_id,
            center_id,
            session_id=session_id,
            client_ids=client_ids or [],
            author_id=author_id,
            transcript_text=transcript_text,
            entries_text=entries_text,
            summary_text=summary_text,
            total_duration=total_duration,
            note_template_type=note_template_type,
        ),
        actor_id=author_id or None,
    )
    if event_group_id:
        await Event.dispatch_event(event_group_id)


async def process_pipeline(
    field_note_id: str,
    center_id: str,
    start_from: str | None = None,
    skip_refine: bool = True,
    member_id: str | None = None,
) -> None:
    # 전체 파이프라인 순차 실행 — 실패 시 해당 스텝에서 멈춤.
    # 종료(분석) 파이프라인은 전사(+보정)까지만 자동 실행 — summary·상담일지는 상세 화면 온디맨드 전용.
    runner = PipelineRunner(AsyncSessionLocal)

    # start_from은 워커 JSON 경유라 str — str-enum 등가로 membership/index 판정
    start_idx = (
        _PIPELINE_STEPS.index(start_from)
        if start_from and start_from in _PIPELINE_STEPS
        else 0
    )
    current_step = _PIPELINE_STEPS[start_idx]

    try:
        if start_idx <= 0:
            current_step = FieldNotePipelineStep.TRANSCRIBING
            await runner.update_pipeline_status(
                field_note_id,
                center_id,
                FieldNoteProcessingStatus.PROCESSING,
                FieldNotePipelineStep.TRANSCRIBING,
                actor_id=member_id,
            )
            if (
                await process_transcribe(
                    field_note_id, center_id, standalone=False, member_id=member_id
                )
                is None
            ):
                raise RuntimeError("Transcription failed")

        if start_idx <= 1 and not skip_refine:
            current_step = FieldNotePipelineStep.REFINING
            await runner.update_pipeline_status(
                field_note_id,
                center_id,
                FieldNoteProcessingStatus.PROCESSING,
                FieldNotePipelineStep.REFINING,
                actor_id=member_id,
            )
            if (
                await process_refine(
                    field_note_id, center_id, standalone=False, member_id=member_id
                )
                is None
            ):
                raise RuntimeError("Refinement failed")

        await runner.update_pipeline_status(
            field_note_id,
            center_id,
            FieldNoteProcessingStatus.COMPLETED,
            step=None,
            failed_step=None,
            actor_id=member_id,
        )
        logger.info(f"Pipeline completed for field_note={field_note_id}")

    except Exception as e:
        await runner.update_pipeline_status(
            field_note_id,
            center_id,
            FieldNoteProcessingStatus.FAILED,
            step=None,
            failed_step=current_step,
            actor_id=member_id,
        )
        logger.error(
            f"Pipeline failed at '{current_step}' for field_note={field_note_id}: {e}",
            exc_info=True,
        )


# dispatch_job 계약: handler(target_id, center_id=, **params) — 첫 위치인자 = target_id(field_note_id)
async def process_transcribe_chunk(
    field_note_id: str,
    *,
    center_id: str,
    audio_id: str,
    storage_path: str,
    member_id: str | None = None,
) -> None:
    await transcribe_chunk(
        PipelineRunner(AsyncSessionLocal),
        create_ai_facade(),
        get_storage_client(),
        audio_id=audio_id,
        storage_path=storage_path,
        center_id=center_id,
        field_note_id=field_note_id,
        member_id=member_id,
    )
