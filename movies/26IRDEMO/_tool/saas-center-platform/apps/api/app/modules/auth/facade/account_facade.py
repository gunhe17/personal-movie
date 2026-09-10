from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..account.events import AccountAtomic
from ..account.repository import AccountRepository
from ..account.services import (
    GetAccountByIdsService,
    LockAccountService,
    UnlockAccountService,
    ForceLogoutService,
)
from ..account.models import Account


class AccountFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def get_accounts_by_ids(self, account_ids: list[str]) -> dict[str, Account]:
        if not account_ids:
            return {}

        repo = self._uow.repo(AccountRepository)
        account_service = GetAccountByIdsService(repo)
        accounts = await account_service.execute(account_ids)

        return accounts

    async def lock_account(self, account_id: str) -> tuple[AccountAtomic, Account]:
        repo = self._uow.repo(AccountRepository)
        return await LockAccountService(repo).execute(account_id)

    async def unlock_account(self, account_id: str) -> tuple[AccountAtomic, Account]:
        repo = self._uow.repo(AccountRepository)
        return await UnlockAccountService(repo).execute(account_id)

    async def force_logout(self, account_id: str) -> tuple[AccountAtomic, Account]:
        repo = self._uow.repo(AccountRepository)
        return await ForceLogoutService(repo).execute(account_id)
