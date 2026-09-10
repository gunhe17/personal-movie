from ..models import AssessmentSession
from ..repository import AssessmentSessionRepository


class ListAssessmentSessionsByAgentFiltersService:
    def __init__(
        self,
        repo: AssessmentSessionRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        sort: str = "desc",
        limit: int = 20,
        **filters,
    ) -> tuple[list[AssessmentSession], int]:
        return await self._repo.list_agent_filtered(
            center_id, sort=sort, limit=limit, **filters,
        )
