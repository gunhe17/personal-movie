from dataclasses import dataclass
from datetime import datetime
from pydantic import BaseModel, Field, model_validator, ConfigDict


class AddressInfo(BaseModel):
    zip_code: str | None = Field(default=None, pattern=r"^\d{5}$")
    address: str | None = Field(default=None, max_length=300)
    detail: str | None = Field(default=None, max_length=200)


class InstitutionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = Field(
        default=None,
        pattern=r"^\d{2,3}-\d{3,4}-\d{4}$",
    )
    address: AddressInfo | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "서울시립아동병원",
                "phone": "02-1234-5678",
                "address": {
                    "zip_code": "06234",
                    "address": "서울특별시 강남구 테헤란로 123",
                    "detail": "본관 3층"
                }
            }
        }
    )


class InstitutionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, pattern=r"^\d{2,3}-\d{3,4}-\d{4}$")
    address: AddressInfo | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "phone": "02-9876-5432",
                "address": {
                    "zip_code": "06234",
                    "address": "서울특별시 강남구 테헤란로 456",
                    "detail": "신관 2층"
                }
            }
        }
    )

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null (omit the field to keep unchanged)")
        return self


class InstitutionResponse(BaseModel):
    id: str
    name: str
    phone: str | None
    address: AddressInfo | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InstitutionSummary(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}


class InstitutionListResponse(BaseModel):
    items: list[InstitutionSummary]
    total: int
    page: int
    size: int
    pages: int


@dataclass
class AddressCommand:
    zip_code: str | None = None
    address: str | None = None
    detail: str | None = None


@dataclass
class CreateInstitutionCommand:
    name: str
    phone: str | None = None
    address: AddressCommand | None = None


@dataclass
class UpdateInstitutionCommand:
    name: str | None = None
    phone: str | None = None
    address: AddressCommand | None = None
