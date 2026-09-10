from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class AssessmentSendResult(BaseModel):
    __tablename__ = "assessment_send_results"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    case_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "assessment_cases"})
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="alarmtalk")
    verification_code: Mapped[str] = mapped_column(String(4), nullable=False, index=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recipients: Mapped[list] = mapped_column(JSONB, nullable=False)

    __table_args__ = (
        Index("ix_assessment_send_results_center_case", "center_id", "case_id"),
    )
