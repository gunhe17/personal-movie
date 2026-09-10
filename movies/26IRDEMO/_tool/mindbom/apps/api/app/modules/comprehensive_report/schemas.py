"""종합보고서 Schemas — 요청/응답 DTO"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# --- 요청 ---

class ComprehensiveReportCreate(BaseModel):
    """종합보고서 생성 요청"""
    client_id: str
    examination_ids: list[str] = Field(..., min_length=2)  # '종합' → 2개 이상
    title: str | None = None


class ReportSection(BaseModel):
    """보고서 섹션 (문서의 한 블록)"""
    key: str
    title: str
    body: str = ""
    source: Literal["auto", "clinician", "ai"] = "clinician"
    order: int = 0
    editable: bool = True  # header/administered_tests는 읽기전용(False)


class ComprehensiveReportUpdate(BaseModel):
    """섹션/메타 저장 (임상가 편집)"""
    title: str | None = None
    sections: list[ReportSection] | None = None
    note: str | None = None


class GenerateDraftRequest(BaseModel):
    """AI 초안 생성 요청"""
    mode: Literal["fill_empty", "replace_ai_sections"] = "fill_empty"


# --- 응답 ---

class LinkedExamination(BaseModel):
    """보고서에 링크된 검사 요약"""
    examination_id: str
    exam_type: str
    exam_type_label: str
    exam_date: datetime | None = None
    sort_order: int = 0
    is_deleted: bool = False  # 원본 검사 삭제됨 표시


class ComprehensiveReportResponse(BaseModel):
    """종합보고서 전체 (섹션 + 링크 검사 포함)"""
    id: str
    institution_id: str
    client_id: str
    client_name: str | None = None
    examiner_id: str
    examiner_name: str | None = None
    title: str | None = None
    status: str
    status_label: str
    sections: list[ReportSection] = []
    linked_examinations: list[LinkedExamination] = []
    ai_model_version: str | None = None
    ai_generated_at: datetime | None = None
    confirmed_by: str | None = None
    confirmed_at: datetime | None = None
    report_generated_at: datetime | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class ComprehensiveReportSummary(BaseModel):
    """목록용 요약 행"""
    id: str
    client_id: str
    title: str | None = None
    status: str
    status_label: str
    exam_count: int
    created_at: datetime
    updated_at: datetime


class ComprehensiveReportListResponse(BaseModel):
    items: list[ComprehensiveReportSummary]
    total: int
