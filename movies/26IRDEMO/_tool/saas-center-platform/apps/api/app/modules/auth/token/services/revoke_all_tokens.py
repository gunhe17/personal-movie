from ..events import RefreshTokenAtomic
from ..repository import RefreshTokenRepository


class RevokeAllTokensService:
    def __init__(self, repo: RefreshTokenRepository):
        self.repo = repo

    async def execute(self, account_id: str) -> tuple[list[RefreshTokenAtomic], int]:
        # remove
        tokens = await self.repo.hard_delete_by_account_id(account_id)

        # return
        atomics = [RefreshTokenAtomic.revoked(token=t)[0] for t in tokens]
        return atomics, len(atomics)
