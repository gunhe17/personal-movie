from ..models import AssessmentCaseParticipant
from ..repository import AssessmentCaseParticipantRepository


class ListAssessmentParticipantsByAgentFiltersService:
    def __init__(
        self,
        repo: AssessmentCaseParticipantRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        sort: str = "desc",
        limit: int = 200,
        **filters,
    ) -> tuple[list[AssessmentCaseParticipant], int]:
        return await self._repo.list_agent_filtered(
            center_id, sort=sort, limit=limit, **filters,
        )
