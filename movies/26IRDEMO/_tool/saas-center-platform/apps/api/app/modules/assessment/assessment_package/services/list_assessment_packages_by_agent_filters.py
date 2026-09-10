from ..models import AssessmentPackage
from ..repository import AssessmentPackageRepository


class ListAssessmentPackagesByAgentFiltersService:
    def __init__(
        self,
        repo: AssessmentPackageRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        sort: str | None = None,
        limit: int = 20,
        **filters,
    ) -> tuple[list[AssessmentPackage], int]:
        rows = await self._repo.list_agent_filtered(
            center_id, sort=sort, limit=limit, **filters,
        )
        total = await self._repo.aggregate_in_center(center_id, **filters)
        return rows, total
