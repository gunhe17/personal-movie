from enum import Enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class TaskStatus(str, Enum):
    # 검사 Task 수행 상태
    #
    # - pending: 대기중 (아직 시작 안 함)
    # - in_progress: 진행중 (검사 진행 중, 제출 전)
    # - submitted: 제출완료 (채점+PDF 완료, 담당자 검수 대기)
    # - completed: 검수완료 (담당자가 보고서 확인 후 완료 처리)
    # - refused: 거부 (내담자가 검사 거부)
    # - cancelled: 취소 (센터/검사자가 취소)
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    REFUSED = "refused"
    CANCELLED = "cancelled"


# #
# model

class AssessmentTask(BaseModel):
    __tablename__ = "assessment_tasks"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    case_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "assessment_cases"})
    assessment_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "assessments"})
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "assessment_sessions"})
    report_document_id: Mapped[str | None] = mapped_column(String(36), nullable=True, default=None, index=True, info={"reference_table_name": "documents"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    execution_method: Mapped[str] = mapped_column(String(20), nullable=False, default="onsite")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
    is_report_visible_to_guardian: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    process: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    opinion: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    report_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)

    __table_args__ = (
        Index(
            "uq_case_assessment_task",
            "case_id",
            "assessment_id",
            unique=True,
            postgresql_where="deleted_at IS NULL",
        ),
        Index("ix_assessment_tasks_center_id", "center_id"),
        Index("ix_assessment_tasks_case_status", "case_id", "status"),
        Index("ix_assessment_tasks_session", "session_id"),
    )
