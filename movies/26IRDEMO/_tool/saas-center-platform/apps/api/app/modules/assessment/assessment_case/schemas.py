from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict

from .models import CaseStatus


class AssessmentSummary(BaseModel):
    id: str
    code: str
    kor_name: str
    eng_name: str
    assessment_type: str
    duration: int | None = None


class InstitutionSummary(BaseModel):
    institution_id: str
    name: str
    phone: str | None = None
    address: dict | None = None


class SetSummary(BaseModel):
    set_id: str
    name: str
    source_updated_at: datetime | None = None
    snapshot_at: datetime


class DocumentRef(BaseModel):
    id: str
    name: str


class AssessmentCaseCreate(BaseModel):
    counselor_id: str = Field(..., description="담당 검사자 ID (메인)")
    client_ids: list[str] = Field(min_length=1)
    assistant_ids: list[str] | None = None
    institution_id: str | None = None
    assessment_ids: list[str] = Field(min_length=1)
    set_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_final_report_required: bool = False


class ScheduleUpdateInput(BaseModel):
    has_schedule: bool = Field(description="일정 사용 여부")
    scheduled_start: datetime | None = Field(None, description="일정 시작 시간")
    scheduled_end: datetime | None = Field(None, description="일정 종료 시간")
    room_id: str | None = Field(None, description="장소 ID")
    memo: str | None = Field(None, description="메모")


class AssessmentCaseUpdate(BaseModel):
    counselor_id: str | None = Field(None, description="담당 검사자 ID (메인)")

    assessment_ids: list[str] | None = Field(None, description="검사 ID 목록")
    set_id: str | None = Field(None, description="검사 세트 ID")

    client_ids: list[str] | None = Field(None, description="내담자 ID 목록")
    assistant_ids: list[str] | None = Field(None, description="보조 검사자 ID 목록")

    institution_id: str | None = Field(None, description="기관 ID")

    tags: list[str] | None = Field(None, description="태그")
    is_final_report_required: bool | None = Field(None, description="종합보고서 필요 여부")

    schedule: ScheduleUpdateInput | None = Field(None, description="일정 수정 정보")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "assessment_ids": ["assess-1", "assess-2"],
                "set_id": "set-uuid",
                "tags": ["긴급"],
                "is_final_report_required": True,
                "schedule": {
                    "has_schedule": True,
                    "scheduled_start": "2026-01-20T10:00:00Z",
                    "scheduled_end": "2026-01-20T12:00:00Z",
                    "room_id": "room-uuid"
                }
            }
        }
    )


class AssessmentCaseResponse(BaseModel):
    id: str
    center_id: str
    case_code: str
    counselor_id: str
    institution_summary: InstitutionSummary | None = None
    assessment_summary: list[AssessmentSummary]
    set_summary: SetSummary | None = None
    documents: list[DocumentRef] = Field(default_factory=list)
    tags: list[str]
    is_final_report_required: bool
    status: str
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssessmentCaseSummary(BaseModel):
    id: str
    center_id: str
    case_code: str
    counselor_id: str
    status: str
    tags: list[str]
    is_final_report_required: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConflictDetail(BaseModel):
    conflict_type: str = Field(description="충돌 유형")
    resource_id: str = Field(description="리소스 ID")
    resource_name: str = Field(description="리소스 이름")
    current_status: str = Field(description="현재 상태")
    message: str = Field(description="충돌 메시지")


class UpdateValidationResult(BaseModel):
    can_update: bool = Field(description="force 없이 수정 가능 여부")
    conflicts: list[ConflictDetail] = Field(default_factory=list, description="중요한 충돌 목록")
    warnings: list[dict] = Field(default_factory=list, description="자동 처리되는 경고")
    affected_resources: dict = Field(default_factory=dict, description="영향받는 리소스")


class AssessmentCaseUpdateResponse(BaseModel):
    case: AssessmentCaseResponse | None = Field(None, description="수정된 케이스 (force=true 시)")
    validation: UpdateValidationResult | None = Field(None, description="검증 결과 (force=false 시)")
    applied_changes: dict | None = Field(None, description="적용된 변경사항 (force=true 시)")
