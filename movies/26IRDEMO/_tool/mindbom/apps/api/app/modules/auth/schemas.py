"""Auth Schemas (Request/Response DTOs)"""
from pydantic import BaseModel, Field


# --- Request DTOs ---

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class SignupRequest(BaseModel):
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1, max_length=100)
    institution_name: str = Field(..., min_length=1, max_length=200)


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class VerifyPasswordRequest(BaseModel):
    password: str = Field(..., min_length=1)


# --- Response DTOs ---

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str  # 현재 선택된 기관에서의 역할 (멤버십 0개면 "clinician")


class InstitutionResponse(BaseModel):
    id: str
    name: str


class InstitutionMembership(BaseModel):
    """계정의 기관 멤버십 1개 단위 — 멀티 기관 로그인 응답에 사용"""
    institution_id: str
    institution_name: str
    member_id: str
    name: str  # 해당 기관에서의 표시 이름
    role: str  # admin | clinician | researcher


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserResponse  # 기본 선택 멤버십 기준 (institutions[0])
    institution: InstitutionResponse  # 기본 선택 기관 (호환)
    institutions: list[InstitutionMembership]  # 모든 멤버십
    requires_institution_choice: bool = False  # len(institutions) > 1


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int  # seconds


class MeResponse(BaseModel):
    user: UserResponse
    institution: InstitutionResponse | None = None
    institutions: list[InstitutionMembership] = []


class MessageResponse(BaseModel):
    message: str
