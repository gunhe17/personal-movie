from datetime import datetime
from enum import Enum
from typing import Literal, Annotated, Union
from pydantic import BaseModel, Field

from .models import TaskStatus


class ExecutionMethod(str, Enum):
    ONSITE = "onsite"
    ONLINE = "online"


class TaskSubmitBase(BaseModel):
    workflow_type: str


class SelfReportSubmitData(TaskSubmitBase):
    workflow_type: Literal["self_report"]
    responses: list[dict]
    current_item: int | None = None


class ExternalServiceSubmitData(TaskSubmitBase):
    workflow_type: Literal["external_service"]
    report_document_id: str  # 이미 업로드된 Document ID
    report_payload: dict | None = None


TaskSubmitData = Annotated[
    Union[
        SelfReportSubmitData,
        ExternalServiceSubmitData,
    ],
    Field(discriminator='workflow_type')
]

# 하위 호환성을 위한 alias (deprecated)
TaskSubmit = SelfReportSubmitData


class TaskRefuse(BaseModel):
    reason: str | None = None


class TaskCancel(BaseModel):
    reason: str | None = None


class TaskOpinionUpdate(BaseModel):
    # opinion=null 또는 빈 문자열이면 소견 해제.
    opinion: str | None = Field(default=None, max_length=5000, description="검사자 소견 (최대 5000자)")


class AssessmentInfo(BaseModel):
    code: str
    kor_name: str
    workflow_type: str
    definition: dict  # self_report: questions, external_service: empty
    external_url: str | None = None
    duration: int | None = None  # 예상 소요 시간(분), Assessment 엔티티 컬럼


class TaskResponse(BaseModel):
    id: str
    case_id: str
    assessment_id: str
    center_id: str
    execution_method: str
    process: dict
    status: str
    report_payload: dict | None = None
    report_document_id: str | None = None
    is_report_visible_to_guardian: bool
    opinion: str | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # 검사 정보 (목록 조회 시 None, 상세 조회 시 포함)
    assessment: AssessmentInfo | None = None

    model_config = {"from_attributes": True}


class TaskReportResponse(BaseModel):
    case_id: str
    assessment_id: str
    report_payload: dict | None
    is_report_visible_to_guardian: bool
    completed_at: datetime | None
