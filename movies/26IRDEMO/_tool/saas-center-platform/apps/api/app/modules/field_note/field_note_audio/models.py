from enum import Enum

from sqlalchemy import String, Integer, Float, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class FieldNoteAudioTranscriptStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# #
# model

class FieldNoteAudio(BaseModel):
    __tablename__ = "field_note_audios"

    field_note_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "field_notes"})
    transcript_status: Mapped[str] = mapped_column(String(20), nullable=False, default=FieldNoteAudioTranscriptStatus.PENDING)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    stt_model_used: Mapped[str | None] = mapped_column(String(50), nullable=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    diarized_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_audio_field_note", "field_note_id"),
        Index("idx_audio_chunk", "field_note_id", "chunk_index"),
    )

    def __repr__(self) -> str:
        return f"<FieldNoteAudio(id={self.id}, field_note_id={self.field_note_id}, chunk={self.chunk_index})>"
