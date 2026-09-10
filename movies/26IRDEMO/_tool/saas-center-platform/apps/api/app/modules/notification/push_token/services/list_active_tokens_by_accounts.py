from ..repository import PushTokenRepository
from ..models import PushToken


class ListActiveTokensByAccountsService:
    def __init__(self, repo: PushTokenRepository):
        self.repo = repo

    async def execute(
        self,
        account_ids: list[str],
        center_id: str | None = None,
    ) -> list[PushToken]:
        # return
        return await self.repo.list_active_by_accounts(
            center_id=center_id,
            account_ids=account_ids,
        )

