from app.core.datetime_utils import utc_now
from app.infrastructure.hash.factory import get_token_hasher
from app.core.exceptions import PermissionDeniedException
from app.modules.platform_admin.admin_refresh_token.repository import AdminRefreshTokenRepository
from app.modules.platform_admin.admin_refresh_token.models import AdminRefreshToken


class ValidateAdminRefreshTokenService:
    # Admin RefreshToken 검증
    #
    # - 토큰 해시로 DB 조회
    # - 만료 여부 확인

    def __init__(self, repo: AdminRefreshTokenRepository):
        self.repo = repo

    async def execute(self, token: str) -> AdminRefreshToken:
        # 1. 토큰 해시로 조회
        token_hash = get_token_hasher().hash(value=token)
        refresh_token = await self.repo.find_by_token_hash(token_hash)

        if not refresh_token:
            raise PermissionDeniedException("Invalid refresh token")

        # 2. 사용 여부 확인 (one-time use)
        if refresh_token.used_at is not None:
            raise PermissionDeniedException("Refresh token already used")

        # 3. 만료 확인
        if refresh_token.expires_at < utc_now():
            raise PermissionDeniedException("Refresh token expired")

        return refresh_token
