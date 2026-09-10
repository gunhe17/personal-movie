from ..models import LoginNotification
from ..repository import LoginNotificationRepository


class GetRecentLoginsService:
    def __init__(self, repo: LoginNotificationRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        days: int = 1,
        limit: int = 50,
    ) -> list[LoginNotification]:
        # return
        return await self.repo.list_recent_by_account(
            account_id=account_id,
            days=days,
            limit=limit,
        )
