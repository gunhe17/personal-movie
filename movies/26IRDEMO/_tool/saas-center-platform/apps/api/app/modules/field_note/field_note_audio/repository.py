from sqlalchemy import func, select

from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import FieldNoteAudio, FieldNoteAudioTranscriptStatus


class FieldNoteAudioRepository(PostgresRepository[FieldNoteAudio]):
    model = FieldNoteAudio

    # #
    # command

    @typecheck
    async def add(
        self,
        field_note_id: uuid_str,
        chunk_index: int,
        storage_path: str,
        duration: float,
        transcript_status: FieldNoteAudioTranscriptStatus = FieldNoteAudioTranscriptStatus.PENDING,
        stt_model_used: str | None = None,
        diarized_transcript: str | None = None,
    ) -> FieldNoteAudio:
        return await super().add(
            FieldNoteAudio(
                field_note_id=field_note_id,
                chunk_index=chunk_index,
                storage_path=storage_path,
                duration=duration,
                transcript_status=transcript_status,
                stt_model_used=stt_model_used,
                diarized_transcript=diarized_transcript,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        audio_id: uuid_str,
        *,
        transcript: str | None = unset,
        transcript_status: FieldNoteAudioTranscriptStatus = unset,
        diarized_transcript: str | None = unset,
        stt_model_used: str | None = unset,
    ) -> FieldNoteAudio:
        updated = await self.update_fields(
            audio_id,
            transcript=transcript,
            transcript_status=transcript_status,
            diarized_transcript=diarized_transcript,
            stt_model_used=stt_model_used,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def list_by_field_note(
        self,
        field_note_id: uuid_str,
    ) -> list[FieldNoteAudio]:
        # created_at 2차 키 — chunk_index 동률(구 버그로 전부 0인 기존 행) 순서 보장
        stmt = (
            select(FieldNoteAudio)
            .where(
                FieldNoteAudio.field_note_id == field_note_id,
                FieldNoteAudio.deleted_at.is_(None),
            )
            .order_by(FieldNoteAudio.chunk_index.asc(), FieldNoteAudio.created_at.asc())
        )
        return await self._scalars(stmt)

    @typecheck
    async def find_first_with_storage(
        self,
        field_note_id: uuid_str,
    ) -> FieldNoteAudio | None:
        return await self._find(
            where=[
                FieldNoteAudio.field_note_id == field_note_id,
                FieldNoteAudio.storage_path.isnot(None),
            ],
            order_by="created_at",
        )

    @typecheck
    async def next_chunk_index(
        self,
        field_note_id: uuid_str,
    ) -> int:
        stmt = select(func.coalesce(func.max(FieldNoteAudio.chunk_index), -1)).where(
            FieldNoteAudio.field_note_id == field_note_id,
            FieldNoteAudio.deleted_at.is_(None),
        )
        # `or -1` 금지 — max=0(첫 청크)이 falsy라 -1로 삼켜져 모든 청크가 index 0이 된다(실증 2026-07-13)
        return (await self._session.scalar(stmt)) + 1
