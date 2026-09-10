from ..events import LoginNotificationAtomic
from ..models import LoginNotification
from ..repository import LoginNotificationRepository


class MarkLoginNotificationNotifiedService:
    def __init__(
        self,
        repo: LoginNotificationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        notification_id: str,
    ) -> tuple[LoginNotificationAtomic | None, LoginNotification | None]:
        # mutate
        notification = await self.repo.update_notified(notification_id=notification_id)
        if notification is None:
            return None, None

        # return
        return LoginNotificationAtomic.notified(notification=notification)
