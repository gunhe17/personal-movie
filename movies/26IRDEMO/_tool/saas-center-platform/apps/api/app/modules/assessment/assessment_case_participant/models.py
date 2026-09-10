from datetime import datetime

from sqlalchemy import DateTime, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.models import BaseModel


# #
# model

class AssessmentCaseParticipant(BaseModel):
    __tablename__ = "assessment_case_participants"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    case_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "assessment_cases"})
    participant_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_type_field": "participant_type", "reference_tables": {"client": "clients", "assistant": "members"}})
    participant_type: Mapped[str] = mapped_column(String(20), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, default=utc_now)
    unassigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)

    __table_args__ = (
        UniqueConstraint("case_id", "participant_type", "participant_id", name="uq_case_participant"),
        Index("ix_assessment_case_participants_center_id", "center_id"),
        Index("ix_assessment_case_participants_participant", "participant_type", "participant_id"),
        Index("ix_assessment_case_participants_case_type", "case_id", "participant_type"),
    )
