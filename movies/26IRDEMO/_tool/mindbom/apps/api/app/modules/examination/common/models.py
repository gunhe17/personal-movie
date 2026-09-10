"""검사 공통 모델

Examination: 검사 건 (HTP/Rorschach/SCT 공통)
상태 머신:
  created → in_progress → ai_draft_ready
  → under_review → confirmed → report_generated → completed
"""
from datetime import datetime
from typing import Any
from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class Examination(BaseModel):
    """검사 건

    하나의 검사 건은 하나의 검사 유형(HTP/Rorschach/SCT)에 대응.
    복합 검사(배터리)인 경우 ExaminationBattery로 묶음.

    Attributes:
        institution_id: 기관 ID
        client_id: 내담자 ID
        examiner_id: 검사자 (Member ID)
        exam_type: 검사 유형 (htp, rorschach, sct)
        status: 검사 상태 (상태 머신)
        battery_id: 배터리 ID (복합 검사 시)
        scheduled_at: 예정일
        started_at: 시작일
        completed_at: 완료일
        ai_model_version: AI 모델 버전 (SaMD 추적용)
        note: 비고
    """

    __tablename__ = "examinations"

    institution_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    examiner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    exam_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="created", index=True)

    battery_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

    ai_model_version: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="AI 모델 버전 (SaMD 추적)")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    result_data: Mapped[dict[str, Any] | None] = mapped_column(
        MutableDict.as_mutable(JSONB),
        nullable=True,
        comment="검사 유형별 결과 데이터 (HTP/Rorschach/SCT)",
    )


class ExaminationBattery(BaseModel):
    """검사 배터리 (복합 검사 묶음)

    HTP + Rorschach + SCT를 하나의 배터리로 묶어 관리.
    """

    __tablename__ = "examination_batteries"

    institution_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    examiner_id: Mapped[str] = mapped_column(String(36), nullable=False)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="created")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
