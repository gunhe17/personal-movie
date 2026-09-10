from app.core.exceptions import EntityNotFoundException

from ..events import AccountAtomic
from ..models import Account
from ..repository import AccountRepository


class DeactivateAccountService:
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def execute(self, account_id: str) -> tuple[AccountAtomic, Account]:
        # load
        account = await self.repo.find_by_id(id=account_id)
        if not account:
            raise EntityNotFoundException(f"계정을 찾을 수 없습니다: {account_id}")

        # update
        await self.repo.update_in_place(id=account_id, is_active=False)
        await self.repo.increment_token_version(id=account_id)
        await self.repo.remove_by_id(id=account_id)

        # return
        account = await self.repo.find_by_id_including_deleted(id=account_id)
        assert account is not None
        return AccountAtomic.deleted(account=account)
