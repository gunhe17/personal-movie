from ..models import Account
from ..repository import AccountRepository


class GetAccountByIdsService:
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def execute(self, account_ids: list[str]) -> dict[str, Account]:
        # return
        accounts = await self.repo.list_by_ids(account_ids=account_ids)
        return {account.id: account for account in accounts}
