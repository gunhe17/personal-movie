from app.infrastructure.persistence.new_repository import Page

from ..repository import NotificationRepository
from ..models import Notification


class ListNotificationsForRecipientService:
    def __init__(
        self,
        repo: NotificationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        recipient_id: str,
        *,
        category: str | None = None,
        is_read: bool | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Notification], Page]:
        # return
        return await self.repo.list_by_recipient_with_page(
            recipient_id=recipient_id,
            category=category,
            is_read=is_read,
            page=page,
            size=size,
        )
