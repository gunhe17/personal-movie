from datetime import datetime
from pydantic import BaseModel, Field

from ..assessment.schemas import AssessmentSummary


class SetSummarySnapshot(BaseModel):
    set_id: str
    name: str
    source_updated_at: datetime = Field(description="원본 세트의 마지막 수정 시간")
    snapshot_at: datetime = Field(description="스냅샷 생성 시간")


class CaseCreationRequest(BaseModel):
    center_id: str
    counselor_id: str
    client_ids: list[str] = Field(min_length=1, description="참여 내담자 ID 목록")
    assistant_ids: list[str] = Field(default_factory=list, description="참여 검사자 ID 목록 (counselor_id 제외)")
    assessment_ids: list[str] = Field(min_length=1, description="실시할 검사 ID 목록")
    assessment_summary: list[AssessmentSummary] = Field(description="검사 요약 (스냅샷)")
    set_summary: SetSummarySnapshot | None = Field(default=None, description="세트 요약 (스냅샷)")
    institution_summary: dict | None = Field(default=None, description="기관 요약 (일괄 접수용)")
    tags: list[str] = Field(default_factory=list, description="케이스 태그")
    is_final_report_required: bool = Field(default=False, description="종합보고서 필요 여부")


class CaseCreationResult(BaseModel):
    case_id: str
    case_code: str
    created_at: datetime


class CaseParticipantDTO(BaseModel):
    participant_type: str = Field(description="참여자 유형 (client/assistant)")
    participant_id: str = Field(description="참여자 ID")
    unassigned_at: datetime | None = Field(default=None, description="배정 해제 시간")


class SessionCreationRequest(BaseModel):
    center_id: str
    case_id: str
    schedule_id: str = Field(description="일정 ID (Schedule 모듈에서 생성된 것)")


class SessionCreationResult(BaseModel):
    session_id: str
    status: str
    created_at: datetime


class BulkCaseCreationRequest(BaseModel):
    center_id: str
    counselor_id: str
    client_ids: list[str] = Field(min_length=1, description="여러 내담자 ID 목록")
    assistant_ids: list[str] = Field(default_factory=list, description="참여 검사자 ID 목록")
    assessment_ids: list[str] = Field(min_length=1, description="실시할 검사 ID 목록")
    assessment_summary: list["AssessmentSummary"] = Field(description="검사 요약 (스냅샷)")
    institution_summary: dict | None = Field(default=None, description="기관 요약 (스냅샷)")
    set_summary: "SetSummarySnapshot | None" = Field(default=None, description="세트 요약 (스냅샷)")
    tags: list[str] = Field(default_factory=list, description="케이스 태그")
    is_final_report_required: bool = Field(default=False, description="종합보고서 필요 여부")


class BulkCaseCreationResult(BaseModel):
    cases: list[CaseCreationResult] = Field(description="생성된 Case 목록")
    total_count: int = Field(description="생성된 Case 수")


class BulkSessionCreationRequest(BaseModel):
    center_id: str
    case_ids: list[str] = Field(min_length=1, description="Case ID 목록")
    schedule_id: str = Field(description="공통 일정 ID (Schedule 모듈에서 생성된 것)")


class BulkSessionCreationResult(BaseModel):
    sessions: list[SessionCreationResult] = Field(description="생성된 Session 목록")
    total_count: int = Field(description="생성된 Session 수")


class UnsharedCompletedCase(BaseModel):
    case_id: str
    completed_at: datetime
