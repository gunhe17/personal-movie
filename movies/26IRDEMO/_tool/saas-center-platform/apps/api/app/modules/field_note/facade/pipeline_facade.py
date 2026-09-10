from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..field_note.events import FieldNoteAtomic
from ..field_note.models import FieldNote
from ..field_note.repository import FieldNoteRepository
from ..pipeline.events import FieldNoteAudioAtomic
from ..field_note_audio.models import FieldNoteAudio, FieldNoteAudioTranscriptStatus
from ..field_note_audio.repository import FieldNoteAudioRepository
from ..field_note_entry.repository import FieldNoteEntryRepository

from ..field_note.schemas import FieldNoteDetailResponse
from ..field_note.services import (
    FindFieldNoteService,
    GetFieldNoteService,
    RetryPipelineService,
    PrepareSummaryService,
)
from ..field_note_audio.services import ListAudiosService
from ..field_note_entry.services import ListEntriesService
from ..field_note_audio.services.merge_audio import merge_audio_chunks
from ..pipeline.services import (
    BuildTranscriptSegmentsService,
    BuildTranscriptTextService,
    ClearAudioTranscriptService,
    ListRefineSegmentsService,
    MarkAudioDiarizedService,
    MarkAudioMergedService,
    MarkAudioTranscribedService,
    MarkSummaryCompletedService,
    MarkTranscriptRefinedService,
    UpdateAudioTranscriptStatusService,
    UpdateFieldNoteStatusesService,
    merge_chunk_transcripts,
)
from ..pipeline.services.prepare_pipeline_step import (
    PreparePipelineStepService,
    StepResult,
)
from ..pipeline.services.prepare_run_pipeline import PrepareRunPipelineService


class PipelineFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def retry_pipeline_with_response(
        self,
        field_note_id: str,
        center_id: str,
    ) -> tuple[FieldNoteAtomic, FieldNoteDetailResponse, str]:
        atomic, field_note, start_from = await RetryPipelineService(
            self._uow.repo(FieldNoteRepository)
        ).execute(
            field_note_id=field_note_id,
            center_id=center_id,
        )

        audios = await ListAudiosService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(field_note_id)
        entries = await ListEntriesService(
            self._uow.repo(FieldNoteEntryRepository)
        ).execute(field_note_id)

        response = FieldNoteDetailResponse.build(field_note, audios, entries)
        return atomic, response, start_from

    async def prepare_step(
        self,
        field_note_id: str,
        center_id: str,
        *,
        step: str,
        note_template_type: str | None = None,
    ) -> tuple[FieldNoteAtomic | None, StepResult]:
        note_repo = self._uow.repo(FieldNoteRepository)
        return await PreparePipelineStepService(note_repo).execute(
            field_note_id,
            center_id,
            step=step,
            note_template_type=note_template_type,
        )

    # #
    # runtime 엔진 전용 DB 통로 — 전부 얇은 위임 (R1: runtime은 facade만)

    async def find_note(
        self,
        field_note_id: str,
        center_id: str,
    ):
        return await FindFieldNoteService(self._uow.repo(FieldNoteRepository)).execute(
            field_note_id,
            center_id,
        )

    async def list_audios(
        self,
        field_note_id: str,
    ):
        return await ListAudiosService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(field_note_id)

    async def load_merged_transcript(
        self,
        field_note_id: str,
    ) -> dict:
        return merge_chunk_transcripts(await self.list_audios(field_note_id))

    async def merge_audio_bytes(
        self,
        audios,
        storage,
    ) -> bytearray:
        return await merge_audio_chunks(audios, storage)

    async def set_statuses(
        self,
        field_note_id: str,
        center_id: str,
        **fields,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        return await UpdateFieldNoteStatusesService(
            self._uow.repo(FieldNoteRepository)
        ).execute(
            field_note_id,
            center_id,
            **fields,
        )

    async def mark_audio_diarized(
        self,
        audio_id: str,
        *,
        diarize_result: dict,
        stt_model: str,
    ) -> tuple[FieldNoteAudioAtomic, FieldNoteAudio]:
        return await MarkAudioDiarizedService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(
            audio_id,
            diarize_result=diarize_result,
            stt_model=stt_model,
        )

    async def mark_audio_merged(
        self,
        audio_id: str,
    ) -> tuple[FieldNoteAudioAtomic, FieldNoteAudio]:
        return await MarkAudioMergedService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(audio_id)

    async def clear_audio_transcript(
        self,
        audio_id: str,
    ) -> tuple[FieldNoteAudioAtomic, FieldNoteAudio]:
        return await ClearAudioTranscriptService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(audio_id)

    async def set_audio_transcript(
        self,
        audio_id: str,
        *,
        text: str,
        model: str,
    ) -> tuple[FieldNoteAudioAtomic, FieldNoteAudio]:
        return await MarkAudioTranscribedService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(
            audio_id,
            text=text,
            model=model,
        )

    async def set_audio_status(
        self,
        audio_id: str,
        *,
        transcript_status: str,
    ) -> tuple[FieldNoteAudioAtomic, FieldNoteAudio]:
        return await UpdateAudioTranscriptStatusService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(
            audio_id,
            transcript_status=transcript_status,
        )

    async def list_refine_segments(
        self,
        field_note_id: str,
    ) -> list[dict]:
        return await ListRefineSegmentsService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(field_note_id)

    async def mark_transcript_refined(
        self,
        field_note_id: str,
        center_id: str,
        *,
        refined_json: str,
        model: str | None,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        return await MarkTranscriptRefinedService(
            self._uow.repo(FieldNoteRepository)
        ).execute(
            field_note_id,
            center_id,
            refined_json=refined_json,
            model=model,
        )

    async def load_summary_context(
        self,
        field_note_id: str,
        center_id: str,
    ) -> dict:
        note_repo = self._uow.repo(FieldNoteRepository)
        field_note = await GetFieldNoteService(note_repo).execute(
            field_note_id, center_id
        )
        audios = await self.list_audios(field_note_id)
        entries = await ListEntriesService(
            self._uow.repo(FieldNoteEntryRepository)
        ).execute(field_note_id)
        return {
            "field_note": field_note,
            "transcript_text": BuildTranscriptTextService().execute(field_note, audios),
            "segments": BuildTranscriptSegmentsService().execute(field_note, audios),
            "entries": entries,
        }

    async def mark_summary_completed(
        self,
        field_note_id: str,
        center_id: str,
        *,
        summary_text: str,
        model: str,
        analysis_json: str | None = None,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        return await MarkSummaryCompletedService(
            self._uow.repo(FieldNoteRepository)
        ).execute(
            field_note_id,
            center_id,
            summary_text=summary_text,
            model=model,
            analysis_json=analysis_json,
        )

    async def _get_field_note(self, field_note_id: str, center_id: str):
        note_repo = self._uow.repo(FieldNoteRepository)
        return note_repo, await GetFieldNoteService(note_repo).execute(
            field_note_id, center_id
        )

    async def collect_note_data(
        self,
        field_note_id: str,
        center_id: str,
    ) -> dict:
        _, field_note = await self._get_field_note(field_note_id, center_id)

        if field_note.status != "completed":
            raise InvalidOperationException(
                "녹음이 완료된 필드노트만 상담일지를 생성할 수 있습니다."
            )
        if not field_note.schedule_id:
            raise InvalidOperationException(
                "일정에 연결된 필드노트만 상담일지를 생성할 수 있습니다."
            )

        audios = await ListAudiosService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(field_note_id)
        entries = await ListEntriesService(
            self._uow.repo(FieldNoteEntryRepository)
        ).execute(field_note_id)

        transcript_text = BuildTranscriptTextService().execute(field_note, audios)

        entry_texts = []
        for entry in sorted(entries, key=lambda e: e.timestamp_seconds):
            if entry.entry_type == "tag":
                entry_texts.append(
                    f"[{entry.timestamp_seconds:.0f}초] 태그: #{entry.content}"
                )
            else:
                entry_texts.append(
                    f"[{entry.timestamp_seconds:.0f}초] 메모: {entry.content}"
                )
        entries_text = "\n".join(entry_texts) if entry_texts else "(메모 없음)"

        return {
            "field_note": field_note,
            "schedule_id": field_note.schedule_id,
            "note_template_type": field_note.note_template_type,
            "transcript_text": transcript_text,
            "entries_text": entries_text,
            "summary_text": field_note.summary or "(요약 없음)",
            "total_duration": field_note.total_duration or 0,
        }

    async def prepare_run_pipeline(
        self,
        field_note_id: str,
        center_id: str,
    ) -> "tuple[FieldNoteAtomic | None, StepResult, str | None]":
        note_repo = self._uow.repo(FieldNoteRepository)
        return await PrepareRunPipelineService(note_repo).execute(
            field_note_id=field_note_id,
            center_id=center_id,
        )
