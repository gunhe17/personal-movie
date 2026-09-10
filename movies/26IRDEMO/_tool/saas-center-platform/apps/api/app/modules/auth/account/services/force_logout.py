from ..events import AccountAtomic
from ..models import Account
from ..repository import AccountRepository


class ForceLogoutService:
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
        await self.repo.get_by_id(id=account_id)

        # mutate
        account = await self.repo.increment_token_version(id=account_id)
        assert account is not None

        # return
        return AccountAtomic.force_logged_out(account=account)
