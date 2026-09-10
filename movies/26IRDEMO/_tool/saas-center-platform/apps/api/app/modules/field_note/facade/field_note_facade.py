import json

from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..field_note.models import FieldNote
from ..field_note.events import FieldNoteAtomic
from ..field_note.repository import FieldNoteRepository
from ..field_note_audio.repository import FieldNoteAudioRepository
from ..field_note_entry.repository import FieldNoteEntryRepository
from ..field_note.schemas import FieldNoteDetailResponse
from ..field_note.services import (
    BuildRecommendationContextService,
    ClearNoteStatusService,
    CreateFieldNoteService,
    ListFieldNotesService,
    GetFieldNoteService,
    ListLinkedTaskIdsService,
    GetFirstAudioForLabService,
    GetPreviousSummariesService,
    ExportTranscriptService,
    LinkTaskService,
    ListAudioCandidatesForLabService,
)
from ..field_note.services.export_transcript import ExportResult
from ..field_note_audio.services import ListAudiosService
from ..field_note_entry.services import ListEntriesService


class FieldNoteFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def create_field_note(
        self,
        center_id: str,
        *,
        author_id: str,
        schedule_id: str | None = None,
        task_id: str | None = None,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        service = CreateFieldNoteService(self._uow.repo(FieldNoteRepository))
        return await service.execute(
            center_id=center_id,
            author_id=author_id,
            schedule_id=schedule_id,
            task_id=task_id,
        )

    async def link_task(
        self,
        field_note_id: str,
        center_id: str,
        *,
        task_id: str,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        service = LinkTaskService(self._uow.repo(FieldNoteRepository))
        return await service.execute(
            field_note_id=field_note_id,
            center_id=center_id,
            task_id=task_id,
        )

    async def list_linked_task_ids(
        self,
        center_id: str,
    ) -> set[str]:
        return await ListLinkedTaskIdsService(
            self._uow.repo(FieldNoteRepository)
        ).execute(
            center_id=center_id,
        )

    async def get_field_note_with_response(
        self,
        field_note_id: str,
        center_id: str,
    ) -> FieldNoteDetailResponse:
        field_note = await GetFieldNoteService(
            self._uow.repo(FieldNoteRepository)
        ).execute(
            field_note_id,
            center_id,
        )
        audios = await ListAudiosService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(field_note_id)
        entries = await ListEntriesService(
            self._uow.repo(FieldNoteEntryRepository)
        ).execute(field_note_id)
        return FieldNoteDetailResponse.build(field_note, audios, entries)

    # previous_summaries(이전 회기 요약)는 cross-module 조회 결과 — application handler가
    # ScheduleFacade·CounselingSessionFacade로 모아 전달한다.
    async def generate_recommendation_context(
        self,
        field_note_id: str,
        center_id: str,
        *,
        previous_summaries: list[str] | None = None,
    ) -> str:
        await GetFieldNoteService(self._uow.repo(FieldNoteRepository)).execute(
            field_note_id,
            center_id,
        )
        audios = await ListAudiosService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(field_note_id)
        entries = await ListEntriesService(
            self._uow.repo(FieldNoteEntryRepository)
        ).execute(field_note_id)
        return BuildRecommendationContextService().execute(
            audios,
            entries,
            previous_summaries,
        )

    async def export_transcript_with_response(
        self,
        field_note_id: str,
        center_id: str,
        *,
        format: str,
    ) -> ExportResult:
        audios = await ListAudiosService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(field_note_id)
        fallback_segments: list[dict] | None = None
        if audios and audios[0].diarized_transcript:
            try:
                raw = json.loads(audios[0].diarized_transcript)
                fallback_segments = raw.get("segments", [])
            except (json.JSONDecodeError, TypeError):
                pass

        export_service = ExportTranscriptService(self._uow.repo(FieldNoteRepository))
        return await export_service.execute(
            field_note_id=field_note_id,
            center_id=center_id,
            format=format,
            fallback_segments=fallback_segments,
        )

    async def list_audio_candidates_for_lab(
        self,
        *,
        limit: int = 50,
    ) -> list[dict]:
        return await ListAudioCandidatesForLabService(
            self._uow.repo(FieldNoteRepository)
        ).execute(limit=limit)

    async def get_first_audio_for_lab(
        self,
        field_note_id: str,
    ) -> dict | None:
        return await GetFirstAudioForLabService(
            self._uow.repo(FieldNoteAudioRepository)
        ).execute(field_note_id)

    async def get_summaries_by_schedule_ids(
        self,
        schedule_ids: list[str],
        center_id: str,
    ) -> list[FieldNote]:
        if not schedule_ids:
            return []
        return await GetPreviousSummariesService(
            self._uow.repo(FieldNoteRepository)
        ).execute(
            schedule_ids=schedule_ids,
            center_id=center_id,
            limit=len(schedule_ids),
        )

    async def clear_note_status(
        self,
        field_note_id: str,
        center_id: str,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        return await ClearNoteStatusService(
            self._uow.repo(FieldNoteRepository)
        ).execute(
            field_note_id=field_note_id,
            center_id=center_id,
        )

    async def list_field_notes(
        self,
        center_id: str,
        *,
        status: str | None = None,
        processing_status: str | None = None,
        analysis_state: str | None = None,
        linked: bool | None = None,
        link_type: str | None = None,
        author_id: str | None = None,
        page: int = 1,
        size: int = 20,
    ):
        return await ListFieldNotesService(self._uow.repo(FieldNoteRepository)).execute(
            center_id,
            status=status,
            processing_status=processing_status,
            analysis_state=analysis_state,
            linked=linked,
            link_type=link_type,
            author_id=author_id,
            page=page,
            size=size,
        )
