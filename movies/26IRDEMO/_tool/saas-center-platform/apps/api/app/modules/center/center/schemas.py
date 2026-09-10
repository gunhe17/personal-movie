from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field, model_validator, ConfigDict

if TYPE_CHECKING:
    from app.modules.center.center_application.schemas import CenterApplicationSummary


class AddressInfo(BaseModel):
    zip_code: str | None = Field(default=None, pattern=r"^\d{5}$", description="5자리 우편번호")
    address: str | None = Field(default=None, max_length=300, description="주소 (도로명/지번)")
    detail: str | None = Field(default=None, max_length=200, description="상세주소")


class CenterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="센터 이름")
    phone: str | None = Field(
        default=None,
        pattern=r"^\d{2,3}-\d{3,4}-\d{4}$",
        description="전화번호 (02-1234-5678)"
    )
    address: AddressInfo | None = None
    description: str | None = None
    logo_url: str | None = Field(default=None, max_length=500)
    image_urls: list[str] | None = Field(default=None, description="센터 이미지 URL 목록")
    business_registration_number: str | None = Field(
        default=None,
        pattern=r"^\d{3}-\d{2}-\d{5}$",
        description="사업자등록번호 (000-00-00000)"
    )
    representative_name: str | None = Field(default=None, max_length=100, description="대표자명")


class CenterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, pattern=r"^\d{2,3}-\d{3,4}-\d{4}$")
    address: AddressInfo | None = None
    description: str | None = None
    logo_url: str | None = Field(default=None, max_length=500)
    image_urls: list[str] | None = Field(default=None, description="센터 이미지 URL 목록")
    business_registration_number: str | None = Field(
        default=None,
        pattern=r"^\d{3}-\d{2}-\d{5}$"
    )
    representative_name: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null (omit the field to keep unchanged)")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "마음치유 심리상담센터",
                "phone": "02-9876-5432",
                "description": "청소년 및 성인 심리상담, 가족상담 전문"
            }
        }
    )


class CenterResponse(BaseModel):
    id: str
    name: str
    code: str
    phone: str | None
    address: AddressInfo | None
    description: str | None
    logo_url: str | None
    image_urls: list[str] | None
    business_registration_number: str | None
    representative_name: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CenterSummary(BaseModel):
    id: str
    name: str
    code: str
    logo_url: str | None

    model_config = {"from_attributes": True}


class CenterListResponse(BaseModel):
    centers: list[CenterSummary]
    applications: list[CenterApplicationSummary]
    total: int
    page: int
    size: int
    pages: int
