
from ..events import RefreshTokenAtomic
from ..models import RefreshToken
from ..repository import RefreshTokenRepository


class RevokeDeviceService:
    def __init__(self, repo: RefreshTokenRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        session_id: str,
    ) -> tuple[RefreshTokenAtomic, RefreshToken]:
        # load
        session = await self.repo.get_by_account(session_id, account_id=account_id)

        # remove
        await self.repo.hard_delete_by_id(session_id)
        return RefreshTokenAtomic.revoked(token=session)
