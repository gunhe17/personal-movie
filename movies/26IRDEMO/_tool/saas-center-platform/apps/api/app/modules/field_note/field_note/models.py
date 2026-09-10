from datetime import datetime
from enum import Enum

from sqlalchemy import String, DateTime, Float, Integer, Text, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class FieldNoteStatus(str, Enum):
    RECORDING = "recording"
    COMPLETED = "completed"


class FieldNoteProcessingStatus(str, Enum):
    IDLE = "idle"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


# processing_step·failed_step 공용 어휘 — 값은 프론트 라벨 계약(웹 STEP_LABELS·모바일 PROCESSING_STEP_LABELS)
class FieldNotePipelineStep(str, Enum):
    TRANSCRIBING = "transcribing"
    REFINING = "refining"
    SUMMARIZING = "summarizing"
    DIARIZING = "diarizing"
    GENERATING_NOTE = "generating_note"


class FieldNoteTranscribeStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class FieldNoteRefineStatus(str, Enum):
    NONE = "none"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class FieldNoteDiarizationStatus(str, Enum):
    NONE = "none"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class FieldNoteNoteStatus(str, Enum):
    NONE = "none"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class FieldNoteSummaryStatus(str, Enum):
    NONE = "none"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


# #
# model

class FieldNote(BaseModel):
    __tablename__ = "field_notes"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    schedule_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "schedules"})
    task_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "assessment_tasks"})
    author_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=FieldNoteStatus.RECORDING)
    processing_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=FieldNoteProcessingStatus.IDLE, server_default="idle"
    )
    transcribe_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=FieldNoteTranscribeStatus.PENDING, server_default="pending"
    )
    refine_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=FieldNoteRefineStatus.NONE, server_default="none"
    )
    diarization_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=FieldNoteDiarizationStatus.NONE, server_default="none"
    )
    note_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=FieldNoteNoteStatus.NONE, server_default="none"
    )
    note_template_type: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    summary_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=FieldNoteSummaryStatus.NONE, server_default="none"
    )
    processing_step: Mapped[str | None] = mapped_column(String(30), nullable=True)
    failed_step: Mapped[str | None] = mapped_column(String(30), nullable=True)
    refinement_model: Mapped[str | None] = mapped_column(String(50), nullable=True)
    summary_model: Mapped[str | None] = mapped_column(String(50), nullable=True)
    note_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_duration: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    summary_generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    refined_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    speaker_map: Mapped[str | None] = mapped_column(Text, nullable=True)
    nonverbal_markers: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "idx_field_note_schedule",
            "schedule_id",
            unique=True,
            postgresql_where=text("schedule_id IS NOT NULL AND deleted_at IS NULL"),
        ),
        Index(
            "idx_field_note_task",
            "task_id",
            unique=True,
            postgresql_where=text("task_id IS NOT NULL AND deleted_at IS NULL"),
        ),
        Index("idx_field_note_center", "center_id"),
        Index("idx_field_note_author", "author_id"),
        # 작성자별 순번 — 살아있는 노트 기준 unique (동시 생성 race 방어).
        # deleted_at 된 노트는 제외하되, 번호 부여는 삭제분 포함 max+1 이라 재사용은 없음.
        Index(
            "idx_field_note_author_number",
            "center_id",
            "author_id",
            "note_number",
            unique=True,
            postgresql_where=text("note_number IS NOT NULL AND deleted_at IS NULL"),
        ),
    )

    def __repr__(self) -> str:
        return f"<FieldNote(id={self.id}, schedule_id={self.schedule_id}, task_id={self.task_id}, status={self.status})>"
