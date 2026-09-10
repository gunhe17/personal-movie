from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class LabSampleDataset(BaseModel):
    __tablename__ = "lab_sample_datasets"

    field_note_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "field_notes"})
    author_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    input_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    source_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tags: Mapped[str | None] = mapped_column(String(500), nullable=True)
    audio_duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    audio_file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_segments: Mapped[str | None] = mapped_column(Text, nullable=True)
