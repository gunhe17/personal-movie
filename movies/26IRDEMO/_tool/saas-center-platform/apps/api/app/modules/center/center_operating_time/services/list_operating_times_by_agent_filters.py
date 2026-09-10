from ..models import OperatingTime
from ..repository import OperatingTimeRepository


class ListOperatingTimesByAgentFiltersService:
    def __init__(
        self,
        repo: OperatingTimeRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        sort: str | None = None,
        limit: int = 20,
        **filters,
    ) -> tuple[list[OperatingTime], int]:
        rows = await self._repo.list_agent_filtered(
            center_id, sort=sort, limit=limit, **filters,
        )
        total = await self._repo.aggregate_in_center(center_id, **filters)
        return rows, total
