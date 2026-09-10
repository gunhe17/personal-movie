from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict

from ..center.schemas import AddressInfo


# *enum
STATUS = {"PENDING", "APPROVED", "REJECTED"}


class CenterApplicationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="센터 이름")
    phone: str | None = Field(
        None,
        pattern=r"^\d{2,3}-\d{3,4}-\d{4}$",
        description="전화번호 (02-1234-5678)"
    )
    address: AddressInfo | None = None
    description: str | None = None
    business_registration_number: str | None = Field(
        None,
        pattern=r"^\d{3}-\d{2}-\d{5}$",
        description="사업자등록번호 (000-00-00000)"
    )
    representative_name: str | None = Field(None, max_length=100, description="대표자명")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "마음치유 심리상담센터",
                "phone": "02-1234-5678",
                "address": {
                    "zip_code": "06234",
                    "address": "서울특별시 강남구 테헤란로 123",
                    "detail": "스타빌딩 5층"
                },
                "description": "청소년 및 성인 심리상담 전문센터입니다.",
                "business_registration_number": "123-45-67890",
                "representative_name": "김상담"
            }
        }
    )


class CenterApplicationUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, pattern=r"^\d{2,3}-\d{3,4}-\d{4}$")
    address: AddressInfo | None = None
    description: str | None = None
    business_registration_number: str | None = Field(
        None,
        pattern=r"^\d{3}-\d{2}-\d{5}$"
    )
    representative_name: str | None = Field(None, max_length=100)

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null (omit the field to keep unchanged)")
        return self


class CenterApplicationReject(BaseModel):
    reviewed_reason: str | None = Field(
        None,
        min_length=1,
        max_length=500,
        description="거절 사유"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "reviewed_reason": "사업자등록번호 확인이 필요합니다. 정확한 번호를 재입력하여 다시 신청해주세요."
            }
        }
    )


class CenterApplicationResponse(BaseModel):
    id: str
    created_by: str
    # Center Info
    name: str
    phone: str | None
    address: AddressInfo | None
    description: str | None
    business_registration_number: str | None
    representative_name: str | None
    # Status
    status: str  # PENDING, APPROVED, REJECTED
    # Review
    reviewed_at: datetime | None
    reviewed_by: str | None
    reviewed_reason: str | None
    # Result
    center_id: str | None
    # Timestamps
    created_at: datetime
    updated_at: datetime

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in STATUS:
            raise ValueError(f"상태는 {STATUS} 중 하나여야 합니다")
        return v

    model_config = {"from_attributes": True}


class CenterApplicationSummary(BaseModel):
    id: str
    name: str
    status: str  # PENDING, APPROVED, REJECTED
    created_at: datetime

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in STATUS:
            raise ValueError(f"상태는 {STATUS} 중 하나여야 합니다")
        return v

    model_config = {"from_attributes": True}


class CenterApplicationListResponse(BaseModel):
    items: list[CenterApplicationSummary]
    total: int
    page: int
    size: int
    pages: int
