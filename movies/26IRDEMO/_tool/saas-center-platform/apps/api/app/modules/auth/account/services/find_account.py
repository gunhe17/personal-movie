from ..models import Account
from ..repository import AccountRepository


class FindAccountService:
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def execute(self, account_id: str) -> Account | None:
        # return
        return await self.repo.find_by_id(id=account_id)
