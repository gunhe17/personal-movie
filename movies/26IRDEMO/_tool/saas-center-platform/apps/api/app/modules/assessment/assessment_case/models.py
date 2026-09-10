from enum import Enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class CaseStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# #
# model

class AssessmentCase(BaseModel):
    __tablename__ = "assessment_cases"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    counselor_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    case_code: Mapped[str] = mapped_column(String(50), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
    is_final_report_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    documents: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    tags: Mapped[list] = mapped_column(ARRAY(String(50)), nullable=False, default=list)
    institution_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    assessment_summary: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    set_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)

    __table_args__ = (
        UniqueConstraint("center_id", "case_code", name="uq_assessment_case_code"),
        Index("ix_assessment_cases_center_id", "center_id"),
        Index("ix_assessment_cases_status", "status"),
        Index("ix_assessment_cases_center_status", "center_id", "status"),
        Index("ix_assessment_cases_center_counselor", "center_id", "counselor_id"),
    )
