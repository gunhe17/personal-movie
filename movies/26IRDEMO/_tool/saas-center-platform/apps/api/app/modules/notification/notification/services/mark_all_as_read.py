from ..repository import NotificationRepository
from ..events import NotificationAtomic


class MarkAllAsReadService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        recipient_id: str,
    ) -> tuple[list[NotificationAtomic], int]:
        # update
        notifications = await self.repo.update_all_read_in_center(
            center_id=center_id,
            recipient_id=recipient_id,
        )

        # return (bulk = 1 event + N atomics)
        atomics = [NotificationAtomic.read(notification=n)[0] for n in notifications]
        return atomics, len(notifications)
