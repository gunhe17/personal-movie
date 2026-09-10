import math
from datetime import datetime

from pydantic import BaseModel, Field


class AdminAssessmentSummary(BaseModel):
    id: str
    code: str
    kor_name: str
    eng_name: str
    assessment_type: str
    duration: int | None
    age: str | None
    status: str
    created_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}


class AdminAssessmentDetailResponse(BaseModel):
    id: str
    code: str
    version: str
    kor_name: str
    eng_name: str
    assessment_type: str
    description: str | None
    duration: int | None
    age: str | None
    status: str
    workflow_type: str
    external_url: str | None
    supports_online: bool
    definition: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}


class AdminAssessmentCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    kor_name: str = Field(..., min_length=1, max_length=255)
    eng_name: str = Field(..., min_length=1, max_length=255)
    assessment_type: str = Field(...)
    description: str | None = None
    duration: int | None = Field(default=None, ge=1)
    age: str | None = Field(default=None, max_length=100)
    status: str = Field(default="private")
    version: str = Field(default="1.0", max_length=20)
    workflow_type: str = Field(default="self_report")
    external_url: str | None = Field(default=None, max_length=500)
    supports_online: bool = False
    definition: dict = Field(default_factory=dict)


class AdminAssessmentUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    version: str | None = Field(default=None, max_length=20)
    kor_name: str | None = Field(default=None, min_length=1, max_length=255)
    eng_name: str | None = Field(default=None, min_length=1, max_length=255)
    assessment_type: str | None = None
    description: str | None = None
    duration: int | None = Field(default=None, ge=1)
    age: str | None = None
    status: str | None = None
    workflow_type: str | None = None
    external_url: str | None = None
    supports_online: bool | None = None
    definition: dict | None = None


class AdminAssessmentListResponse(BaseModel):
    items: list[AdminAssessmentSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[AdminAssessmentSummary],
        total: int,
        page: int,
        size: int,
    ) -> "AdminAssessmentListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )
