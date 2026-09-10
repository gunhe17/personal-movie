"""Member Schemas (Request/Response DTOs)"""
from datetime import datetime
from pydantic import BaseModel, Field


class MemberUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    role: str | None = Field(None, pattern="^(admin|clinician|researcher)$")
    is_active: bool | None = None


class MemberSummary(BaseModel):
    id: str
    account_id: str
    name: str
    role: str
    email: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberResponse(BaseModel):
    id: str
    institution_id: str
    account_id: str
    name: str
    role: str
    email: str | None = None
    license_number: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemberListResponse(BaseModel):
    """페이징 목록 응답"""
    items: list[MemberSummary]
    total: int
    page: int
    size: int
    pages: int
