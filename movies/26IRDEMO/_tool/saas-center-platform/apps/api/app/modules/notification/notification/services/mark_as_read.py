from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from ..repository import NotificationRepository
from ..models import Notification
from ..events import NotificationAtomic


class MarkAsReadService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def execute(
        self,
        notification_id: str,
        center_id: str,
        recipient_id: str,
    ) -> tuple[NotificationAtomic, Notification]:
        # load
        notification = await self.repo.get_by_id(notification_id)
        if notification.center_id != center_id or notification.recipient_id != recipient_id:
            raise EntityNotFoundException(f"Notification not found: {notification_id}")

        # update
        if not notification.is_read:
            notification = await self.repo.update_in_place(
                id=notification_id, is_read=True, read_at=utc_now()
            )

        # return
        return NotificationAtomic.read(notification=notification)
