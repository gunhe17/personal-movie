from app.infrastructure.persistence.new_repository import Page

from ..repository import NotificationRepository
from ..models import Notification


class ListNotificationsService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        recipient_id: str,
        *,
        category: str | None = None,
        is_read: bool | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 20,
        sort: str = "desc",
    ) -> tuple[list[Notification], Page]:
        # return
        return await self.repo.list_in_center_with_page(
            center_id=center_id,
            recipient_id=recipient_id,
            category=category,
            is_read=is_read,
            search=search,
            page=page,
            size=size,
            sort=sort,
        )
