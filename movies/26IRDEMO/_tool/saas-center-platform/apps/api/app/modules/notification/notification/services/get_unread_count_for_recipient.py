from ..repository import NotificationRepository


class GetUnreadCountForRecipientService:
    def __init__(
        self,
        repo: NotificationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        recipient_id: str,
    ) -> int:
        # return
        return await self.repo.count_unread_by_recipient(recipient_id=recipient_id)
