from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
import re

from .models import Gender


class PersonCreate(BaseModel):
    account_id: str
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=1, max_length=20)
    birth: date | None = None
    gender: Gender | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(
        cls,
        v: str,
    ) -> str:
        if not re.match(r'^[\d-]+$', v):
            raise ValueError("전화번호는 숫자와 하이픈(-)만 포함해야 합니다")
        return v

    @field_validator("birth")
    @classmethod
    def validate_birth(
        cls,
        v: date | None,
    ) -> date | None:
        if v and v > date.today():
            raise ValueError("생년월일은 미래 날짜일 수 없습니다")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "account_id": "a1b2c3d4-e5f6-7g8h-9i0j-1k2l3m4n5o6p",
                "name": "김철수",
                "phone": "010-1234-5678",
                "birth": "1990-05-15",
                "gender": "male"
            }
        }
    )


class PersonUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, min_length=1, max_length=20)
    birth: date | None = None
    gender: Gender | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(
        cls,
        v: str | None,
    ) -> str | None:
        if v and not re.match(r'^[\d-]+$', v):
            raise ValueError("전화번호는 숫자와 하이픈(-)만 포함해야 합니다")
        return v

    @field_validator("birth")
    @classmethod
    def validate_birth(
        cls,
        v: date | None,
    ) -> date | None:
        if v and v > date.today():
            raise ValueError("생년월일은 미래 날짜일 수 없습니다")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "김영희",
                "phone": "010-9876-5432"
            }
        }
    )


class PersonResponse(BaseModel):
    id: str
    account_id: str
    name: str
    phone: str
    birth: date | None
    gender: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PersonItem(BaseModel):
    id: str
    name: str
    phone: str

    model_config = {"from_attributes": True}


class PersonListResponse(BaseModel):
    items: list[PersonItem]
    total: int
    page: int
    size: int
    pages: int
