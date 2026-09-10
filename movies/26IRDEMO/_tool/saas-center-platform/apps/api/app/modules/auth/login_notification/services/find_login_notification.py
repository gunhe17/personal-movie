from ..models import LoginNotification
from ..repository import LoginNotificationRepository


class FindLoginNotificationService:
    def __init__(
        self,
        repo: LoginNotificationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        notification_id: str,
    ) -> LoginNotification | None:
        # return
        return await self.repo.find_by_id(id=notification_id)
