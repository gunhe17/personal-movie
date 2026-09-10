from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.admin_refresh_token.repository import (
    AdminRefreshTokenRepository,
)
from app.modules.platform_admin.admin_refresh_token.services.validate_admin_refresh_token import (
    ValidateAdminRefreshTokenService,
)
from app.modules.platform_admin.admin_account.services.create_admin_access_token import (
    CreateAdminAccessTokenService,
)
from app.modules.platform_admin.auth.schemas import (
    AdminRefreshRequest,
    AdminRefreshResponse,
)


async def admin_refresh_handler(
    data: AdminRefreshRequest,
    uow: UnitOfWork,
) -> AdminRefreshResponse:
    # RefreshToken 검증 후 새 AccessToken만 발급(refresh 회전 없음).
    # 1. RefreshToken 검증
    refresh_repo = uow.repo(AdminRefreshTokenRepository)
    validate_service = ValidateAdminRefreshTokenService(refresh_repo)
    refresh_token = await validate_service.execute(data.refresh_token)

    # 2. 계정 조회 + Access Token 발급
    admin_repo = uow.repo(AdminAccountRepository)
    access_token_service = CreateAdminAccessTokenService(admin_repo)
    access_token, _ = await access_token_service.execute(
        refresh_token.admin_account_id,
    )

    return AdminRefreshResponse(
        access_token=access_token,
        token_type="Bearer",
        expires_in=30 * 60,
    )


TOOL = {
    "name": "admin_refresh_handler",
    "permission": None,
    "purpose": "운영자 액세스 토큰을 갱신한다.",
    "keywords": ["어드민 토큰 갱신", "관리자 리프레시", "admin refresh"],
    "boundaries": "운영자 토큰 재발급. 로그인은 admin_login_handler.",
    "output": "재발급된 어드민 액세스 토큰 (AdminRefreshResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "refresh_token": {
                "minLength": 1,
                "title": "리프레시 토큰",
                "type": "string",
                "description": "갱신에 사용할 리프레시 토큰.",
            },
        },
        "required": ["refresh_token"],
    },
}
