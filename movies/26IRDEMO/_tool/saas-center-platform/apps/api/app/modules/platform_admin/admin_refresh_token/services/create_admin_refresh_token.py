import secrets
from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.infrastructure.hash.factory import get_token_hasher
from app.modules.platform_admin.admin_refresh_token.repository import AdminRefreshTokenRepository
from app.modules.platform_admin.admin_refresh_token.models import AdminRefreshToken


class CreateAdminRefreshTokenService:
    def __init__(self, repo: AdminRefreshTokenRepository):
        self.repo = repo

    async def execute(
        self,
        admin_account_id: str,
        device_info: str | None = None,
        ip_address: str | None = None,
        expires_days: int = 7,
        max_devices: int = 5,
    ) -> tuple[str, AdminRefreshToken]:
        # 1. 디바이스 개수 확인
        active_tokens = await self.repo.list_active_by_account(admin_account_id=admin_account_id)

        # 2. 초과 시 가장 오래된 토큰 무효화
        if len(active_tokens) >= max_devices:
            oldest = min(active_tokens, key=lambda t: t.created_at)
            await self.repo.update_used(id=oldest.id, used_at=utc_now())

        # 3. 원본 토큰 생성 (32바이트 랜덤)
        token = secrets.token_urlsafe(32)

        # 4. 토큰 해시 (SHA-256)
        token_hash = get_token_hasher().hash(value=token)

        # 5. 만료 시각
        expires_at = utc_now() + timedelta(days=expires_days)

        # 6. DB 저장
        refresh_token = await self.repo.add(
            admin_account_id=admin_account_id,
            token_hash=token_hash,
            device_info=device_info,
            ip_address=ip_address,
            expires_at=expires_at,
        )

        return token, refresh_token
