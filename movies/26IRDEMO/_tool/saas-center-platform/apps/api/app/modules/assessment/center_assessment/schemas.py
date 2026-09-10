from dataclasses import dataclass
from datetime import datetime
from pydantic import BaseModel


class CenterAssessmentCreate(BaseModel):
    assessment_id: str


class CenterAssessmentUpdate(BaseModel):
    is_active: bool


class CenterAssessmentBulkItem(BaseModel):
    assessment_id: str
    is_active: bool


class CenterAssessmentBulkUpdate(BaseModel):
    items: list[CenterAssessmentBulkItem]


class CenterAssessmentResponse(BaseModel):
    center_id: str
    assessment_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CenterAssessmentWithAssessment(BaseModel):
    center_id: str
    assessment_id: str
    is_active: bool

    code: str
    kor_name: str
    eng_name: str
    assessment_type: str
    duration: int | None
    status: str
    supports_online: bool

    created_at: datetime
    updated_at: datetime


@dataclass
class CenterAssessmentWithAssessmentData:
    center_id: str
    assessment_id: str
    is_active: bool

    code: str
    kor_name: str
    eng_name: str
    assessment_type: str
    duration: int | None
    status: str
    supports_online: bool

    created_at: datetime
    updated_at: datetime
