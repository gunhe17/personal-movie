"""RefreshToken Services"""
import uuid
from datetime import timedelta

from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.core.exceptions import UnauthorizedException
from app.core.security import hash_refresh_token
from app.modules.auth.token.models import RefreshToken
from app.modules.auth.token.repository import RefreshTokenRepository


class CreateRefreshTokenService:
    """Refresh Token 생성 (UUID raw token 발급 + 해시 저장)"""
    def __init__(self, repo: RefreshTokenRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> tuple[str, RefreshToken]:
        """Returns (raw_token, db_record)"""
        raw_token = str(uuid.uuid4())
        token_hash = hash_refresh_token(raw_token)
        expires_at = utc_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        record = await self.repo.create({
            "account_id": account_id,
            "token_hash": token_hash,
            "expires_at": expires_at,
            "user_agent": user_agent,
            "ip_address": ip_address,
        })
        return raw_token, record


class ValidateRefreshTokenService:
    """Refresh Token 검증 (해시 조회 + 만료 확인)"""
    def __init__(self, repo: RefreshTokenRepository):
        self.repo = repo

    async def execute(self, raw_token: str) -> RefreshToken:
        token_hash = hash_refresh_token(raw_token)
        record = await self.repo.get_by_token_hash(token_hash)

        if not record:
            raise UnauthorizedException("유효하지 않은 refresh token입니다.")
        if record.expires_at < utc_now():
            raise UnauthorizedException("만료된 refresh token입니다.")
        return record


class RevokeRefreshTokenService:
    """Refresh Token 폐기 (soft delete) — 폐기된 토큰의 account_id 반환 (없으면 None)"""
    def __init__(self, repo: RefreshTokenRepository):
        self.repo = repo

    async def execute(self, raw_token: str) -> str | None:
        token_hash = hash_refresh_token(raw_token)
        record = await self.repo.get_by_token_hash(token_hash)
        if record:
            await self.repo.delete(record.id)
            return record.account_id
        return None
