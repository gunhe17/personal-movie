from datetime import datetime

from sqlalchemy import DateTime, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class AssessmentSessionParticipant(BaseModel):
    __tablename__ = "assessment_session_participants"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "assessment_sessions"})
    participant_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_type_field": "participant_type", "reference_tables": {"client": "clients", "assistant": "members"}})
    participant_type: Mapped[str] = mapped_column(String(20), nullable=False)
    attendance_status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    attended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "participant_type",
            "participant_id",
            name="uq_session_participant",
        ),
        Index("ix_assessment_session_participants_center_id", "center_id"),
        Index("ix_assessment_session_participants_session", "session_id"),
        Index("ix_assessment_session_participants_participant", "participant_type", "participant_id"),
        Index("ix_assessment_session_participants_attendance", "attendance_status"),
    )
