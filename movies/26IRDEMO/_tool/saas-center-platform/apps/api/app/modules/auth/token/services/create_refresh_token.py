import secrets
from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.infrastructure.hash.factory import get_token_hasher

from ..events import RefreshTokenAtomic
from ..models import RefreshToken
from ..repository import RefreshTokenRepository


class CreateRefreshTokenService:
    def __init__(
        self,
        repo: RefreshTokenRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        device_info: str | None = None,
        ip_address: str | None = None,
        expires_days: int = 30,
        max_devices: int = 5,
    ) -> tuple[RefreshTokenAtomic, str, RefreshToken]:
        # evict
        device_count = await self.repo.count_by_account_id(account_id)
        if device_count >= max_devices:
            await self.repo.hard_delete_oldest_by_account(account_id)

        # mint
        token = secrets.token_urlsafe(32)
        token_hash = get_token_hasher().hash(value=token)
        expires_at = utc_now() + timedelta(days=expires_days)

        refresh_token = await self.repo.add(
            account_id=account_id,
            token_hash=token_hash,
            expires_at=expires_at,
            device_info=device_info,
            ip_address=ip_address,
        )

        # return
        atomic, _ = RefreshTokenAtomic.created(token=refresh_token)
        return atomic, token, refresh_token
