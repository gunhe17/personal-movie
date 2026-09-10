from ..repository import NotificationRepository


class GetUnreadCountService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        recipient_id: str,
    ) -> int:
        # return
        return await self.repo.count_unread_in_center(
            center_id=center_id,
            recipient_id=recipient_id,
        )
