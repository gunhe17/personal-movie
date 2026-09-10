from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from ..repository import NotificationRepository
from ..models import Notification
from ..events import NotificationAtomic


class MarkAsReadForRecipientService:
    def __init__(
        self,
        repo: NotificationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        notification_id: str,
        recipient_id: str,
    ) -> tuple[NotificationAtomic, Notification]:
        # load — 앱 인박스는 센터 무관, recipient 소유만 검증
        notification = await self.repo.find_for_recipient(
            notification_id=notification_id,
            recipient_id=recipient_id,
        )
        if notification is None:
            raise EntityNotFoundException(f"Notification not found: {notification_id}")

        # update
        if not notification.is_read:
            notification = await self.repo.update_in_place(
                id=notification_id, is_read=True, read_at=utc_now()
            )

        # return
        return NotificationAtomic.read(notification=notification)
