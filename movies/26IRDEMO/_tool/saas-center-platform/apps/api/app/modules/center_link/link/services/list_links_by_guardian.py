from app.core.type import uuid_str

from ..models import CenterLink
from ..repository import CenterLinkRepository


class ListLinksByGuardianService:
    def __init__(self, repo: CenterLinkRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: uuid_str,
        guardian_client_id: uuid_str,
    ) -> list[CenterLink]:
        # return
        return await self.repo.list_by_guardian_client(
            center_id=center_id,
            guardian_client_id=guardian_client_id,
        )
