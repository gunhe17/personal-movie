from ..repository import NotificationRepository
from ..models import Notification


class ListNotificationsByFiltersService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        recipient_id: str | None = None,
        category: str | None = None,
        event_type: str | None = None,
        priority: str | None = None,
        title: str | None = None,
        unread_only: bool | None = None,
        limit: int = 50,
    ) -> list[Notification]:
        # return
        return await self.repo.list_by_filters(
            center_id=center_id,
            recipient_id=recipient_id,
            category=category,
            event_type=event_type,
            priority=priority,
            title=title,
            unread_only=unread_only,
            limit=limit,
        )
