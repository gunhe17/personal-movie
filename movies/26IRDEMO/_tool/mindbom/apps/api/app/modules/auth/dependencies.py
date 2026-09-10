"""인증/인가 의존성 — 라우터에서 Depends로 주입

core/dependencies.py에서 분리:
- core 레이어가 modules에 의존하지 않도록 modules/auth로 이전.
- 모든 모듈 import는 top-level (lazy import 제거).
"""
from typing import Any

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.modules.auth.account.repository import AccountRepository
from app.modules.auth.account.services import GetAccountService
from app.modules.member.repository import MemberRepository
from app.modules.member.services import GetMemberByAccountService

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """JWT 토큰 검증 및 사용자 정보 추출

    Returns:
        dict: 디코드된 토큰 정보
            - account_id (str)
            - email (str)
            - institution_id (str | None)
    """
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    required_fields = ["sub", "email"]
    if not all(k in payload for k in required_fields):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required fields",
        )

    # sub → account_id 매핑 (하위 호환)
    payload["account_id"] = payload["sub"]

    # Token Version 검증
    account_id = payload["sub"]
    token_account_version = payload.get("account_token_version", 0)

    account_repo = AccountRepository(session)
    account = await GetAccountService(account_repo).execute(account_id)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found",
        )

    if account.token_version != token_account_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalidated. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


class InstitutionContext(BaseModel):
    """기관 접근 컨텍스트 (인증 + 멤버십 검증 완료)"""
    institution_id: str
    account_id: str
    email: str
    member_id: str
    role: str  # admin, clinician, researcher


async def get_institution_context(
    institution_id: str,
    current_user: dict = Depends(get_current_user),
    cookie_institution_id: str | None = Cookie(None, alias="institution_id"),
    session: AsyncSession = Depends(get_db),
) -> InstitutionContext:
    """기관 컨텍스트 생성 (institution_id + 멤버 정보 포함)

    검증 단계:
    1. URL path의 `institution_id` 와 httpOnly cookie 의 institution_id 일치 검증
       - cookie 부재 → 401 (인증 컨텍스트 누락)
       - 불일치 → 403 (변조 의심)
    2. 멤버십 검증 (DB) — 일치한다고 해서 멤버일 것은 아니므로 추가 검증
    """
    if cookie_institution_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing institution context cookie",
        )

    if cookie_institution_id != institution_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institution path/cookie mismatch",
        )

    account_id = current_user["account_id"]

    member_repo = MemberRepository(session)
    member = await GetMemberByAccountService(member_repo).execute(
        institution_id, account_id
    )

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have access to institution {institution_id}",
        )

    return InstitutionContext(
        institution_id=institution_id,
        account_id=current_user["account_id"],
        email=current_user["email"],
        member_id=member.id,
        role=member.role,
    )


def require_role(*allowed_roles: str):
    """역할 기반 접근 제어 (admin, clinician, researcher)"""
    async def check_role(
        ctx: InstitutionContext = Depends(get_institution_context),
    ) -> InstitutionContext:
        if ctx.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required role: {', '.join(allowed_roles)}",
            )
        return ctx

    return check_role
