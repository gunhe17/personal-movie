from app.core.exceptions import InvalidOperationException

from ..events import AccountAtomic
from ..models import Account
from ..repository import AccountRepository


class UnlockAccountService:
    def __init__(
        self,
        repo: AccountRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
    ) -> tuple[AccountAtomic, Account]:
        # load
        account = await self.repo.get_by_id(id=account_id)
        if account.is_active:
            raise InvalidOperationException("잠금되지 않은 계정입니다.")

        # mutate
        unlocked = await self.repo.update_in_place(id=account_id, is_active=True)
        assert unlocked is not None

        # return
        return AccountAtomic.unlocked(account=unlocked)
