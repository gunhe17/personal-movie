from app.core.type import uuid_str

from ..models import CenterLink
from ..repository import CenterLinkRepository


class ListLinksByFamilyService:
    def __init__(self, repo: CenterLinkRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        family_id: uuid_str,
        alive_only: bool = False,
    ) -> list[CenterLink]:
        # return
        if alive_only:
            return await self.repo.list_alive_by_family(family_id=family_id)
        return await self.repo.list_by_family(family_id=family_id)
