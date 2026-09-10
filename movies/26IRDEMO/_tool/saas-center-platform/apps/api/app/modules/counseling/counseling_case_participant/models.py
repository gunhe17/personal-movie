from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class CaseParticipantType(str, Enum):
    CLIENT = "client"
    COUNSELOR = "counselor"


# #
# model


class CounselingCaseParticipant(BaseModel):
    __tablename__ = "counseling_case_participants"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    counseling_case_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "counseling_cases"})
    participant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_type_field": "participant_type", "reference_tables": {"client": "clients", "counselor": "members"}})
    participant_type: Mapped[str] = mapped_column(String(20), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("idx_participant_case", "counseling_case_id"),
        Index("idx_participant_id", "participant_id"),
    )
