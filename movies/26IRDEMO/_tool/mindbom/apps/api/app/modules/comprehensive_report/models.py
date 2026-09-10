"""종합보고서 모델

ComprehensiveReport: 여러 검사를 묶은 통합 보고서 (문서 = sections JSONB)
ComprehensiveReportExamination: 보고서 ↔ 검사 연결 (순서 있는 조인)

CDSS 원칙:
  - sections: 임상가 소유 정본 문서
  - ai_draft: 불변 AI 스냅샷 (sections를 절대 덮지 않음)
"""
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class ComprehensiveReport(BaseModel):
    """종합보고서 (통합 심리학적 평가보고서)

    Attributes:
        institution_id: 기관 ID
        client_id: 내담자 ID (링크된 검사 전부 일치해야 함)
        examiner_id: 생성자 (Member ID)
        title: 보고서 제목
        status: 상태 머신 (draft → ai_generated → under_review → confirmed → report_generated → completed)
        sections: 임상가 소유 정본 문서 (순서 있는 섹션 리스트)
        ai_draft: 불변 AI 스냅샷 (마지막 AI 출력, sections를 덮지 않음)
        ai_model_version: AI 모델 버전 (SaMD 추적)
        ai_generated_at: AI 초안 생성 시각
        confirmed_by: 확정한 Member ID
        confirmed_at: 확정 시각
        report_generated_at: 최초 PDF 생성 시각
        note: 비고
    """

    __tablename__ = "comprehensive_reports"

    institution_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    examiner_id: Mapped[str] = mapped_column(String(36), nullable=False)

    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    sections: Mapped[list[Any] | None] = mapped_column(
        MutableList.as_mutable(JSONB),
        nullable=True,
        comment="임상가 소유 정본 문서 (순서 있는 섹션 리스트)",
    )
    ai_draft: Mapped[dict[str, Any] | None] = mapped_column(
        MutableDict.as_mutable(JSONB),
        nullable=True,
        comment="불변 AI 스냅샷 (sections를 덮지 않음)",
    )

    ai_model_version: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="AI 모델 버전 (SaMD 추적)")
    ai_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

    confirmed_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    report_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class ComprehensiveReportExamination(BaseModel):
    """종합보고서 ↔ 검사 연결 (순서 있는 조인)

    exam_type를 스냅샷으로 저장하여 원본 검사가 삭제돼도 안정적으로 렌더.

    Attributes:
        report_id: 종합보고서 ID (논리 FK)
        examination_id: 검사 ID (논리 FK)
        exam_type: 검사 유형 스냅샷 (htp/rorschach/sct)
        sort_order: 표시 순서
    """

    __tablename__ = "comprehensive_report_examinations"

    report_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    examination_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    exam_type: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
