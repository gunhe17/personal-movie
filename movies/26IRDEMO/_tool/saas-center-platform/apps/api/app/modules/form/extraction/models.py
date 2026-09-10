from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, INT4RANGE
from sqlalchemy.dialects.postgresql.ranges import Range
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class FormExtractionStatus(str, Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# #
# model

class FormExtraction(BaseModel):
    __tablename__ = "form_extractions"

    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    source_document_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "documents"})
    image_document_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "documents"})
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=FormExtractionStatus.PROCESSING,
        server_default=FormExtractionStatus.PROCESSING.value,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    page_range: Mapped[Range | None] = mapped_column(INT4RANGE, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    completed: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    failed: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def is_completed(self) -> bool:
        return self.status == FormExtractionStatus.COMPLETED

    __table_args__ = (
        Index("ix_form_extractions_status", "status"),
        Index("ix_form_extractions_center", "center_id"),
        Index("ix_form_extractions_deleted_at", "deleted_at"),
    )
