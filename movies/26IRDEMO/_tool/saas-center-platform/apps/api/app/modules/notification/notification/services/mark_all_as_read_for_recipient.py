from ..repository import NotificationRepository
from ..events import NotificationAtomic


class MarkAllAsReadForRecipientService:
    def __init__(
        self,
        repo: NotificationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        recipient_id: str,
    ) -> tuple[list[NotificationAtomic], int]:
        # update — 앱 인박스는 센터 무관 단일 인박스, 전 센터 일괄
        notifications = await self.repo.update_all_read_by_recipient(
            recipient_id=recipient_id,
        )

        # return (bulk = 1 event + N atomics)
        atomics = [NotificationAtomic.read(notification=n)[0] for n in notifications]
        return atomics, len(notifications)
