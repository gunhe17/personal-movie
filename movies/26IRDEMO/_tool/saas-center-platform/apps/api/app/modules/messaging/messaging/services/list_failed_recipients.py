from ..models import MessageLog
from ..repository import MessageLogRepository


class ListFailedRecipientsService:
    def __init__(self, repo: MessageLogRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        send_link_id: str | None = None,
        send_result_id: str | None = None,
        form_send_id: str | None = None,
    ) -> list[MessageLog]:
        # return (참조축 하나만)
        if send_link_id:
            return await self.repo.list_failed_by_send_link_id(send_link_id)
        if send_result_id:
            return await self.repo.list_failed_by_send_result_id(send_result_id)
        if form_send_id:
            return await self.repo.list_failed_by_form_send_id(form_send_id)
        return []
