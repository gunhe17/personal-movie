"""Institution Schemas (Request/Response DTOs)"""
from datetime import datetime
from pydantic import BaseModel, Field


class InstitutionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    institution_type: str | None = Field(
        None, pattern="^(hospital|clinic|counseling_center|research)$"
    )
    address: str | None = Field(None, max_length=500)
    phone: str | None = Field(None, max_length=20)
    representative: str | None = Field(None, max_length=100)
    business_number: str | None = Field(None, max_length=20)


class InstitutionResponse(BaseModel):
    id: str
    name: str
    institution_type: str
    address: str | None = None
    phone: str | None = None
    representative: str | None = None
    business_number: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
