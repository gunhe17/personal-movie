from app.core.exceptions import InvalidOperationException, PermissionDeniedException
from app.infrastructure.hash.factory import get_password_hasher

from ..events import AccountAtomic
from ..models import Account
from ..repository import AccountRepository
from ...password_history.repository import PasswordHistoryRepository


class ChangePasswordService:
    # password_history는 account 자격증명과 한 불변식(최근 3개 재사용 금지) — 부속 repo 예외(service.md §4)
    def __init__(
        self,
        repo: AccountRepository,
        history_repo: PasswordHistoryRepository,
    ):
        self.repo = repo
        self.history_repo = history_repo

    async def execute(
        self,
        account_id: str,
        *,
        current_password: str,
        new_password: str,
    ) -> tuple[AccountAtomic, Account]:
        # load
        account = await self.repo.get_by_id(id=account_id)

        # verify
        if not get_password_hasher().verify(hash=account.password, value=current_password):
            raise PermissionDeniedException("Current password is incorrect")

        recent_histories = await self.history_repo.list_recent_by_account(
            account_id=account_id,
            limit=3,
        )
        for history in recent_histories:
            if get_password_hasher().verify(hash=history.password, value=new_password):
                raise InvalidOperationException(
                    "Cannot reuse any of your last 3 passwords. Please choose a different password."
                )

        # persist
        await self.history_repo.add(
            account_id=account_id,
            password=account.password,
        )

        await self.repo.update_in_place(
            id=account_id,
            password=get_password_hasher().hash(value=new_password),
        )

        # token_version 증가로 발급된 모든 JWT 즉시 무효화
        await self.repo.increment_token_version(id=account_id)

        await self.history_repo.hard_delete_old_histories(
            account_id=account_id,
            keep_count=3,
        )

        # return
        return AccountAtomic.password_changed(account=account)
