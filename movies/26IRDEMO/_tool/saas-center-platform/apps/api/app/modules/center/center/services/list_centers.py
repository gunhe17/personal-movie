from ..models import Center
from ..repository import CenterRepository


class ListCentersByIdsService:
    def __init__(self, repo: CenterRepository):
        self.repo = repo

    async def execute(
        self,
        center_ids: list[str],
        skip: int,
        limit: int,
    ) -> tuple[list[Center], int]:
        # load
        centers = await self.repo.list_by_ids(
            center_ids=center_ids,
            skip=skip,
            limit=limit,
        )
        total = await self.repo.count_by_ids(center_ids=center_ids)

        # return
        return centers, total
