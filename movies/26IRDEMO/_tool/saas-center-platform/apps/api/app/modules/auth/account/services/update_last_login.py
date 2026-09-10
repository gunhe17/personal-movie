from app.core.datetime_utils import utc_now

from ..events import AccountAtomic
from ..models import Account
from ..repository import AccountRepository


class UpdateLastLoginService:
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def execute(self, account_id: str) -> tuple[AccountAtomic, Account]:
        # update
        account = await self.repo.update_in_place(account_id, last_login_at=utc_now())
        assert account is not None

        # emit
        return AccountAtomic.logged_in(account=account)
