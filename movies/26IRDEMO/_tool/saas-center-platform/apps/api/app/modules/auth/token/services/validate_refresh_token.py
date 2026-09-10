from app.core.datetime_utils import utc_now
from app.core.exceptions import PermissionDeniedException
from app.infrastructure.hash.factory import get_token_hasher

from ..models import RefreshToken
from ..repository import RefreshTokenRepository


class ValidateRefreshTokenService:
    def __init__(self, repo: RefreshTokenRepository):
        self.repo = repo

    async def execute(self, token: str) -> RefreshToken:
        # load
        token_hash = get_token_hasher().hash(value=token)
        refresh_token = await self.repo.find_by_token_hash(token_hash=token_hash)
        if not refresh_token:
            raise PermissionDeniedException("Invalid refresh token")

        # verify
        if refresh_token.expires_at < utc_now():
            raise PermissionDeniedException("Refresh token expired")

        return refresh_token

