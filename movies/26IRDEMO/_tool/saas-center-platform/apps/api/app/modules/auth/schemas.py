import re
from datetime import datetime, date
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from .account.schemas import AccountSummary


class PersonCreateForSignup(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=1, max_length=20)
    birth: date | None = None
    gender: str | None = Field(None, pattern=r"^(male|female)$")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r'^[\d-]+$', v):
            raise ValueError("전화번호는 숫자와 하이픈(-)만 포함해야 합니다")
        return v

    @field_validator("birth")
    @classmethod
    def validate_birth(cls, v: date | None) -> date | None:
        if v and v > date.today():
            raise ValueError("생년월일은 미래 날짜일 수 없습니다")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "김철수",
                "phone": "010-1234-5678",
                "birth": "1990-05-15",
                "gender": "male"
            }
        }
    )


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="8-72자, 영문자+숫자 조합"
    )
    person: PersonCreateForSignup

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "kimcs@example.com",
                "password": "SecurePass123!",
                "person": {
                    "name": "김철수",
                    "phone": "010-1234-5678",
                    "birth": "1990-05-15",
                    "gender": "male"
                }
            }
        }
    )


class PersonSummary(BaseModel):
    id: str
    name: str
    phone: str
    gender: str | None = None

    model_config = {"from_attributes": True}


class SignupResponse(BaseModel):
    account: AccountSummary
    person: PersonSummary
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int  # seconds


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "kimcs@example.com",
                "password": "SecurePass123!"
            }
        }
    )


class UserCenterSummary(BaseModel):
    id: str
    name: str
    code: str
    logo_url: str | None
    role_code: str | None = None
    role_name: str | None = None
    color: str | None = None
    joined_at: datetime | None = None

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    account: AccountSummary
    person: PersonSummary | None
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    centers: list[UserCenterSummary] = []


class MeResponse(BaseModel):
    account: AccountSummary
    person: PersonSummary | None
    centers: list[UserCenterSummary] = []


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }
    )
