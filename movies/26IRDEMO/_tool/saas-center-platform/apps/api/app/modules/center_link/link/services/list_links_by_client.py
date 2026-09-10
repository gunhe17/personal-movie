from app.core.type import uuid_str

from ..models import CenterLink
from ..repository import CenterLinkRepository


class ListLinksByClientService:
    def __init__(self, repo: CenterLinkRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: uuid_str,
        client_id: uuid_str,
    ) -> list[CenterLink]:
        # return
        return await self.repo.list_alive_by_center_client(
            center_id=center_id,
            client_id=client_id,
        )
