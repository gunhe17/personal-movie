from ..models import AssessmentCase
from ..repository import AssessmentCaseRepository


class ListAssessmentCasesByAgentFiltersService:
    def __init__(
        self,
        repo: AssessmentCaseRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        sort: str = "desc",
        limit: int = 20,
        **filters,
    ) -> tuple[list[AssessmentCase], int]:
        return await self._repo.list_agent_filtered(
            center_id, sort=sort, limit=limit, **filters,
        )
