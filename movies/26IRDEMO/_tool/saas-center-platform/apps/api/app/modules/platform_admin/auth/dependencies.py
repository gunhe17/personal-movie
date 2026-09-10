from typing import Callable

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.infrastructure.token.factory import get_token
from app.core.exceptions import UnauthorizedException, PermissionDeniedException
from app.modules.platform_admin.admin_account.models import AdminRole

security = HTTPBearer()

# 역할 그룹 — SSOT는 AdminRole(admin_account/models.py). 기존 소비처 호환용 재export
SUPER_PLUS = AdminRole.SUPER_PLUS
ADMIN_PLUS = AdminRole.ADMIN_PLUS


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    payload = get_token().decode_access_token(credentials.credentials)
    if not payload:
        raise UnauthorizedException("유효하지 않거나 만료된 토큰입니다")

    # admin 토큰인지 확인 (센터 토큰 혼용 방지)
    if payload.get("token_type") != "admin":
        raise UnauthorizedException("어드민 토큰이 아닙니다")

    admin_account_id = payload.get("admin_account_id")
    if not admin_account_id:
        raise UnauthorizedException("토큰 정보가 올바르지 않습니다")

    return {
        "admin_account_id": admin_account_id,
        "email": payload.get("email", ""),
        "role": payload.get("role", ""),
        "account_token_version": payload.get("account_token_version", 0),
    }


def require_admin_role(*allowed_roles: str) -> Callable:
    """
    특정 역할이 필요한 엔드포인트에 사용하는 의존성 팩토리

    Usage:
        @router.get("/accounts", dependencies=[Depends(require_admin_role("super_admin"))])
        async def list_accounts(...):
            ...

        @router.get("/dashboard", dependencies=[Depends(require_admin_role("super_admin", "admin"))])
        async def dashboard(...):
            ...
    """
    async def _check_role(
        current_admin: dict = Depends(get_current_admin),
    ) -> dict:
        if current_admin["role"] not in allowed_roles:
            raise PermissionDeniedException(
                f"이 작업에는 {', '.join(allowed_roles)} 권한이 필요합니다"
            )
        return current_admin

    return _check_role
