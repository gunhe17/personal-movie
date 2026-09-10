from enum import Enum

from sqlalchemy import String, Float, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class FieldNoteEntryType(str, Enum):
    MEMO = "memo"
    TAG = "tag"


class FieldNoteTagCategory(str, Enum):
    OBSERVATION = "observation"
    BEHAVIOR = "behavior"
    EMOTION = "emotion"
    OTHER = "other"


# #
# model

class FieldNoteEntry(BaseModel):
    __tablename__ = "field_note_entries"

    field_note_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "field_notes"})
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False)
    tag_category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    timestamp_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_entry_field_note", "field_note_id"),
        Index("idx_entry_timestamp", "field_note_id", "timestamp_seconds"),
    )

    def __repr__(self) -> str:
        return f"<FieldNoteEntry(id={self.id}, field_note_id={self.field_note_id}, type={self.entry_type})>"
