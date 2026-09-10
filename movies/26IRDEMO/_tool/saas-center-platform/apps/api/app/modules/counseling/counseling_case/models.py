from enum import Enum
from sqlalchemy import Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class CounselingCaseStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CounselingCase(BaseModel):
    __tablename__ = "counseling_cases"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    program_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "programs"})
    counselor_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=CounselingCaseStatus.ACTIVE, index=True)
    case_code: Mapped[str] = mapped_column(String(6), nullable=False, index=True)
    total_sessions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chief_complaint: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    session_rule: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    memo: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    participant_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint("center_id", "case_code", name="uq_counseling_case_code"),
        Index("idx_counseling_case_center_counselor", "center_id", "counselor_id"),
        Index("idx_counseling_case_program", "program_id"),
    )
