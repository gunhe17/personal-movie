from enum import Enum
from datetime import datetime

from sqlalchemy import DateTime, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class CounselingSessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


# #
# model


class CounselingSession(BaseModel):
    __tablename__ = "counseling_sessions"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    counseling_case_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "counseling_cases"})
    schedule_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "schedules"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=CounselingSessionStatus.SCHEDULED, index=True)
    session_number: Mapped[int | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("idx_session_case", "counseling_case_id"),
        Index("idx_session_schedule", "schedule_id"),
        Index(
            "uq_counseling_session_schedule",
            "schedule_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
