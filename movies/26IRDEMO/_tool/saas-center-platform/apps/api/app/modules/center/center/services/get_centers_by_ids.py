from ..models import Center
from ..repository import CenterRepository


class GetCentersByIdsService:
    def __init__(self, repo: CenterRepository):
        self.repo = repo

    async def execute(self, center_ids: list[str]) -> list[Center]:
        # return
        if not center_ids:
            return []

        return await self.repo.list_by_ids(center_ids=center_ids)
