from enum import Enum
from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    ATTENDED = "attended"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"


# #
# model

class AssessmentSession(BaseModel):
    __tablename__ = "assessment_sessions"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    case_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "assessment_cases"})
    schedule_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "schedules"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    cancel_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("ix_assessment_sessions_center_id", "center_id"),
        Index("ix_assessment_sessions_case_id", "case_id"),
        Index("ix_assessment_sessions_status", "status"),
        Index("ix_assessment_sessions_center_status", "center_id", "status"),
    )
