from ..models import RefreshToken
from ..repository import RefreshTokenRepository


class ListDevicesService:
    def __init__(self, repo: RefreshTokenRepository):
        self.repo = repo

    async def execute(self, account_id: str) -> list[RefreshToken]:
        # return
        return await self.repo.list_by_account_id(account_id)
