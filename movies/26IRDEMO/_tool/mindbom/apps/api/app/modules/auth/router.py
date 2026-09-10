"""Auth Router — 인증 API 엔드포인트"""
from fastapi import APIRouter, Cookie, Depends, Request

from app.modules.auth.dependencies import get_current_user
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.auth.handlers.auth_handlers import (
    handle_change_password,
    handle_forgot_password,
    handle_login,
    handle_logout,
    handle_me,
    handle_refresh,
    handle_reset_password,
    handle_signup,
    handle_verify_password,
)
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MeResponse,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    ResetPasswordRequest,
    SignupRequest,
    VerifyPasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
):
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return await handle_login(body, uow, user_agent, ip_address)


@router.post("/signup", response_model=LoginResponse)
async def signup(
    body: SignupRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_signup(body, uow)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    body: RefreshRequest,
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
):
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return await handle_refresh(body, uow, user_agent, ip_address)


@router.get("/me", response_model=MeResponse)
async def me(
    current_user: dict = Depends(get_current_user),
    cookie_institution_id: str | None = Cookie(None, alias="institution_id"),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_me(
        current_user["account_id"], uow,
        current_institution_id=cookie_institution_id,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    body: RefreshRequest,
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
):
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return await handle_logout(body, uow, user_agent=user_agent, ip_address=ip_address)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return await handle_change_password(
        current_user["account_id"], body, uow,
        user_agent=user_agent, ip_address=ip_address,
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_forgot_password(body, uow)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
):
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return await handle_reset_password(
        body, uow, user_agent=user_agent, ip_address=ip_address,
    )


@router.post("/verify-password", response_model=MessageResponse)
async def verify_password(
    body: VerifyPasswordRequest,
    current_user: dict = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """본인 비밀번호 재확인 — 시크릿 모드 해제 등에 사용 (불일치 시 403)"""
    return await handle_verify_password(current_user["account_id"], body, uow)
