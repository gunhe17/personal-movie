"""Client Schemas (Request/Response DTOs)"""
from datetime import date, datetime
from pydantic import BaseModel, Field


# --- Request DTOs ---

class ClientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    birth_date: date | None = None
    gender: str | None = Field(None, pattern="^(male|female)$")
    phone: str | None = Field(None, max_length=20)
    email: str | None = Field(None, max_length=255)
    education_level: str | None = Field(None, max_length=50)
    occupation: str | None = Field(None, max_length=100)
    referral_source: str | None = Field(None, max_length=200)
    note: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    birth_date: date | None = None
    gender: str | None = Field(None, pattern="^(male|female)$")
    phone: str | None = Field(None, max_length=20)
    email: str | None = Field(None, max_length=255)
    education_level: str | None = Field(None, max_length=50)
    occupation: str | None = Field(None, max_length=100)
    referral_source: str | None = Field(None, max_length=200)
    status: str | None = Field(None, pattern="^(active|inactive)$")
    note: str | None = None


# --- Response DTOs ---

class ClientSummary(BaseModel):
    """목록용 (최소 필드)"""
    id: str
    name: str
    birth_date: date | None = None
    gender: str | None = None
    phone: str | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ClientResponse(BaseModel):
    """상세용 (모든 필드)"""
    id: str
    institution_id: str
    name: str
    birth_date: date | None = None
    gender: str | None = None
    phone: str | None = None
    email: str | None = None
    education_level: str | None = None
    occupation: str | None = None
    referral_source: str | None = None
    status: str
    note: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientListResponse(BaseModel):
    """페이징 목록 응답"""
    items: list[ClientSummary]
    total: int
    page: int
    size: int
    pages: int
