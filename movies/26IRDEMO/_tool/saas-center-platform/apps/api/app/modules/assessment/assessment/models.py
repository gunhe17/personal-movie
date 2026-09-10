from sqlalchemy import Boolean, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from enum import Enum

from app.infrastructure.persistence.models import BaseModel


class AssessmentType(str, Enum):
    PROJECTIVE = "projective"        # 투사적 검사
    INTELLIGENCE = "intelligence"    # 지능검사
    OBJECTIVE = "objective"          # 객관적 검사
    DEVELOPMENTAL = "developmental"  # 발달검사


class AssessmentStatus(str, Enum):
    PRIVATE = "private"  # Global 비공개 (특정 센터에만 할당 가능)
    PUBLIC = "public"    # 모든 센터에서 활성화 가능


class WorkflowType(str, Enum):
    SELF_REPORT = "self_report"          # 자가 응답 + 자동 채점
    EXTERNAL_SERVICE = "external_service"  # 외부 서비스 + 보고서 업로드


# #
# model

class Assessment(BaseModel):
    __tablename__ = "assessments"

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    assessment_type: Mapped[str] = mapped_column("assessment_type", String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=AssessmentStatus.PRIVATE)
    workflow_type: Mapped[str] = mapped_column(String(30), nullable=False, default=WorkflowType.SELF_REPORT)
    kor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    eng_name: Mapped[str] = mapped_column(String(255), nullable=False)
    age: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
    external_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    version: Mapped[str] = mapped_column(String(20), nullable=False, default="1.0")
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    supports_online: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    definition: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    __table_args__ = (
        Index(
            "uq_assessments_code_active",
            "code",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_assessments_code", "code"),
        Index("ix_assessments_status", "status"),
    )
