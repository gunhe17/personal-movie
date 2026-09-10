from datetime import datetime
from pydantic import BaseModel, Field

from ..assessment_set.schemas import CenterMemberSummary

from ..assessment_case.schemas import AssessmentSummary


class AssessmentPackageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    assessment_ids: list[str] = Field(min_length=1)
    center_member_ids: list[str] | None = None
    package_price: int | None = None
    is_active: bool = True


class AssessmentPackageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    assessment_ids: list[str] | None = None
    center_member_ids: list[str] | None = None
    package_price: int | None = None
    is_active: bool | None = None


class AssessmentPackageResponse(BaseModel):
    id: str
    center_id: str
    name: str
    description: str | None = None
    assessment_summary: list[AssessmentSummary]
    center_member_summary: list[CenterMemberSummary] | None = None
    package_price: int | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssessmentPackageSummary(BaseModel):
    id: str
    name: str
    description: str | None = None
    assessments: list[AssessmentSummary] = Field(default_factory=list, description="검사 정보 목록")
    package_price: int | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AssessmentPackageListResponse(BaseModel):
    items: list[AssessmentPackageSummary]
    total: int
    page: int
    size: int
    pages: int
