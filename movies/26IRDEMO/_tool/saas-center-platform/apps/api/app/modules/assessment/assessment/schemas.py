from datetime import datetime
from pydantic import BaseModel, Field

from .models import AssessmentStatus, AssessmentType, WorkflowType


class AssessmentCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, description="검사 코드")
    version: str = Field(..., min_length=1, max_length=20, description="검사 버전")
    kor_name: str = Field(..., min_length=1, max_length=255, description="한국어 검사명")
    eng_name: str = Field(..., min_length=1, max_length=255, description="영어 검사명")
    assessment_type: AssessmentType = Field(..., description="검사 유형")
    description: str | None = Field(default=None, description="검사 설명")
    duration: int | None = Field(default=None, ge=1, description="예상 소요 시간(분)")
    age: str | None = Field(default=None, max_length=100, description="대상 연령")
    status: AssessmentStatus = Field(default=AssessmentStatus.PRIVATE, description="공개 상태")
    workflow_type: WorkflowType = Field(default=WorkflowType.SELF_REPORT, description="워크플로우 타입")
    external_url: str | None = Field(default=None, max_length=500, description="외부 검사 URL")
    definition: dict = Field(default_factory=dict, description="문항 정보")


class AssessmentUpdate(BaseModel):
    version: str | None = Field(default=None, min_length=1, max_length=20)
    kor_name: str | None = Field(default=None, min_length=1, max_length=255)
    eng_name: str | None = Field(default=None, min_length=1, max_length=255)
    assessment_type: AssessmentType | None = None
    description: str | None = None
    duration: int | None = Field(default=None, ge=1)
    age: str | None = Field(default=None, max_length=100)
    status: AssessmentStatus | None = None
    workflow_type: WorkflowType | None = None
    external_url: str | None = None
    definition: dict | None = None


class AssessmentResponse(BaseModel):
    id: str
    code: str
    version: str
    kor_name: str
    eng_name: str
    assessment_type: AssessmentType
    description: str | None
    duration: int | None
    age: str | None
    status: AssessmentStatus
    workflow_type: WorkflowType
    external_url: str | None
    definition: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssessmentSummary(BaseModel):
    id: str
    code: str
    kor_name: str
    eng_name: str
    assessment_type: AssessmentType
    duration: int | None
    supports_online: bool = False

    model_config = {"from_attributes": True}


class AssessmentListResponse(BaseModel):
    items: list[AssessmentSummary]
    total: int
    page: int
    size: int
    pages: int
