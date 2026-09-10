from app.core.exceptions import InvalidOperationException

from ..events import AccountAtomic
from ..models import Account
from ..repository import AccountRepository


class LockAccountService:
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
        if not account.is_active:
            raise InvalidOperationException("이미 잠금된 계정입니다.")

        # mutate
        await self.repo.update_in_place(id=account_id, is_active=False)
        locked = await self.repo.increment_token_version(
            id=account_id
        )  # 즉시 전 세션 무효화
        assert locked is not None

        # return
        return AccountAtomic.locked(account=locked)
