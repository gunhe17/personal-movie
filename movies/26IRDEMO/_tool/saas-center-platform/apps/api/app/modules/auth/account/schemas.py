from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


class AccountCreate(BaseModel):
    email: EmailStr
    password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="8-72자, 영문자+숫자 조합"
    )

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        # bcrypt 제한: 72바이트
        if len(v.encode('utf-8')) > 72:
            raise ValueError("비밀번호는 최대 72바이트를 초과할 수 없습니다")

        if len(v) < 8:
            raise ValueError("비밀번호는 최소 8자 이상이어야 합니다")

        if not re.search(r"[a-zA-Z]", v):
            raise ValueError("비밀번호는 최소 1개의 영문자를 포함해야 합니다")

        if not re.search(r"[0-9]", v):
            raise ValueError("비밀번호는 최소 1개의 숫자를 포함해야 합니다")

        return v


class AccountUpdate(BaseModel):
    email: EmailStr | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: str
    email: str
    is_active: bool
    is_verified: bool
    provider: str
    lock_pin_duration_minute: int | None
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountSummary(BaseModel):
    id: str
    email: str
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="8-72자, 영문자+숫자 조합"
    )

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        # bcrypt 제한: 72바이트
        if len(v.encode('utf-8')) > 72:
            raise ValueError("비밀번호는 최대 72바이트를 초과할 수 없습니다")

        if len(v) < 8:
            raise ValueError("비밀번호는 최소 8자 이상이어야 합니다")

        if not re.search(r"[a-zA-Z]", v):
            raise ValueError("비밀번호는 최소 1개의 영문자를 포함해야 합니다")

        if not re.search(r"[0-9]", v):
            raise ValueError("비밀번호는 최소 1개의 숫자를 포함해야 합니다")

        return v


class SetLockPinRequest(BaseModel):
    lock_pin: str = Field(..., pattern=r"^[0-9]{4}$", description="4자리 숫자")
    lock_pin_duration_minute: int | None = Field(
        None,
        ge=1,
        le=1440,
        description="PIN 유효 시간 (분), null = 재접속 시 항상 PIN 요구"
    )


class VerifyPasswordRequest(BaseModel):
    password: str = Field(..., min_length=1)


class VerifyPasswordResponse(BaseModel):
    verified: bool


class VerifyLockPinRequest(BaseModel):
    lock_pin: str = Field(..., pattern=r"^[0-9]{4}$")
