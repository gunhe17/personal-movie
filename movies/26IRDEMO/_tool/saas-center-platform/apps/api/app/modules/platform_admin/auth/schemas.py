from pydantic import BaseModel, EmailStr, Field, field_validator

from app.modules.platform_admin.admin_account.schemas import (
    AdminAccountSummary,
    validate_admin_password,
)


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class AdminLoginUserInfo(BaseModel):
    email: str
    name: str
    role: str


class AdminLoginResponse(BaseModel):
    requires_2fa: bool = True
    pending_token: str | None = None
    user: AdminLoginUserInfo
    # DEBUG 모드 전용 (2FA 스킵 시 바로 토큰 발급)
    admin_account: AdminAccountSummary | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str | None = None
    expires_in: int | None = None
    must_change_password: bool | None = None


class Verify2FARequest(BaseModel):
    pending_token: str = Field(..., min_length=1)
    code: str = Field(..., min_length=1, max_length=10)


class AdminTokenResponse(BaseModel):
    admin_account: AdminAccountSummary
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    must_change_password: bool = False


class AdminRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class AdminRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1)
    new_password_confirm: str = Field(..., min_length=1)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return validate_admin_password(v)


class ChangePasswordResponse(BaseModel):
    success: bool = True
    message: str = "비밀번호가 변경되었습니다."
