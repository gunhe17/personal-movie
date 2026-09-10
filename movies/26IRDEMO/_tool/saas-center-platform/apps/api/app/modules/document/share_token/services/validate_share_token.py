from app.core.datetime_utils import utc_now
from app.core.exceptions import (
    InvalidOperationException,
    PermissionDeniedException,
)
from app.infrastructure.hash.factory import get_password_hasher

from ..models import ShareToken
from ..repository import ShareTokenRepository


class ValidateShareTokenService:
    def __init__(self, repo: ShareTokenRepository):
        self.repo = repo

    async def execute(self, token: str, password: str | None = None) -> ShareToken:
        # load
        share_token = await self.repo.get_by_token(token)

        # verify
        if self._is_expired(share_token):
            raise InvalidOperationException("Token expired")

        if share_token.password_hash:
            if not password:
                raise InvalidOperationException("Password required")
            if not get_password_hasher().verify(hash=share_token.password_hash, value=password):
                raise PermissionDeniedException("Invalid password")

        if self._is_download_limit_exceeded(share_token):
            raise InvalidOperationException("Download limit exceeded")

        # return
        return share_token

    def _is_expired(self, share_token: ShareToken) -> bool:
        return share_token.expires_at < utc_now()

    def _is_download_limit_exceeded(self, share_token: ShareToken) -> bool:
        if share_token.max_downloads is None:
            return False
        return share_token.download_count >= share_token.max_downloads
