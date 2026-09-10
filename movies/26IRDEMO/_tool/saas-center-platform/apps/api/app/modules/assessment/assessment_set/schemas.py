from datetime import datetime
from pydantic import BaseModel, Field

from ..assessment_case.schemas import AssessmentSummary


class CenterMemberSummary(BaseModel):
    member_id: str
    name: str
    snapshot_at: datetime


class AssessmentSetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    assessment_ids: list[str] = Field(min_length=1)
    center_member_ids: list[str] | None = None


class AssessmentSetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    assessment_ids: list[str] | None = None
    center_member_ids: list[str] | None = None


class AssessmentSetResponse(BaseModel):
    id: str
    center_id: str
    name: str
    description: str | None = None
    assessment_summary: list[AssessmentSummary]
    center_member_summary: list[CenterMemberSummary] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssessmentSetSummary(BaseModel):
    id: str
    name: str
    description: str | None = None
    assessments: list[AssessmentSummary] = Field(default_factory=list, description="검사 정보 목록")
    created_at: datetime

    model_config = {"from_attributes": True}


class AssessmentSetListResponse(BaseModel):
    items: list[AssessmentSetSummary]
    total: int
    page: int
    size: int
    pages: int
