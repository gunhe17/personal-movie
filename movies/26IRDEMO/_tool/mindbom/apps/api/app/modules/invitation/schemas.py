"""직원 초대 Schemas (Request/Response DTOs)"""
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.auth.schemas import LoginResponse


class InvitationCreate(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field("clinician", pattern="^(admin|clinician|researcher)$")


class InvitationAcceptRequest(BaseModel):
    token: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8, max_length=128)


class InvitationVerifyResponse(BaseModel):
    """초대 토큰 미리보기 (수락 페이지 렌더링용)"""
    email: str
    name: str
    institution_name: str
    role: str
    account_exists: bool


class InvitationSummary(BaseModel):
    id: str
    email: str
    name: str
    role: str
    status: str
    expires_at: datetime
    invited_by_account_id: str
    inviter_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InvitationListResponse(BaseModel):
    items: list[InvitationSummary]
    total: int


class InvitationAcceptResponse(LoginResponse):
    """수락 응답 — LoginResponse와 동형 (자동 로그인 포함)"""
    pass
