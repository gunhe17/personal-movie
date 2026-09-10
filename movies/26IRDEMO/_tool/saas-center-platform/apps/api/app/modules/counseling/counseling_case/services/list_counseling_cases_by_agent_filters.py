from ..models import CounselingCase
from ..repository import CounselingCaseRepository


class ListCounselingCasesByAgentFiltersService:
    def __init__(
        self,
        repo: CounselingCaseRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        sort: str = "desc",
        limit: int = 20,
        **filters,
    ) -> tuple[list[CounselingCase], int]:
        return await self._repo.list_agent_filtered(
            center_id, sort=sort, limit=limit, **filters,
        )
