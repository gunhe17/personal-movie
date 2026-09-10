from ..models import CounselingSession
from ..repository import CounselingSessionRepository


class ListCounselingSessionsByAgentFiltersService:
    def __init__(
        self,
        repo: CounselingSessionRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        sort: str = "desc",
        limit: int = 20,
        **filters,
    ) -> tuple[list[CounselingSession], int]:
        return await self._repo.list_agent_filtered(
            center_id, sort=sort, limit=limit, **filters,
        )
