from ..models import FormSend
from ..repository import FormSendRepository


class GetFormSendService:
    def __init__(self, repo: FormSendRepository):
        self.repo = repo

    async def execute(self, center_id: str, send_id: str) -> FormSend:
        # return
        return await self.repo.get_in_center(
            center_id=center_id,
            send_id=send_id,
        )
