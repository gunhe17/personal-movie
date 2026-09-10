from ..events import AccountAtomic
from ..models import Account
from ..repository import AccountRepository


class UpdateAccountStatusService:
    def __init__(
        self,
        repo: AccountRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        is_active: bool,
    ) -> tuple[AccountAtomic, Account]:
        # load
        await self.repo.get_by_id(id=account_id)

        # mutate
        updated = await self.repo.update_in_place(id=account_id, is_active=is_active)
        assert updated is not None

        # return
        return AccountAtomic.status_updated(account=updated)
