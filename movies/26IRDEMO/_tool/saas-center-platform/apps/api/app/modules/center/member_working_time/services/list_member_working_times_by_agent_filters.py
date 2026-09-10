from ..models import MemberWorkingTime
from ..repository import MemberWorkingTimeRepository


class ListMemberWorkingTimesByAgentFiltersService:
    def __init__(
        self,
        repo: MemberWorkingTimeRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        sort: str | None = None,
        limit: int = 20,
        **filters,
    ) -> tuple[list[MemberWorkingTime], int]:
        rows = await self._repo.list_agent_filtered(
            center_id, sort=sort, limit=limit, **filters,
        )
        total = await self._repo.aggregate_in_center(center_id, **filters)
        return rows, total
