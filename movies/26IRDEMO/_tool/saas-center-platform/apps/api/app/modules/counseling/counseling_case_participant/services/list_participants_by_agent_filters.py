from ..models import CounselingCaseParticipant
from ..repository import CounselingCaseParticipantRepository


class ListParticipantsByAgentFiltersService:
    def __init__(
        self,
        repo: CounselingCaseParticipantRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        sort: str = "desc",
        limit: int = 200,
        **filters,
    ) -> tuple[list[CounselingCaseParticipant], int]:
        return await self._repo.list_agent_filtered(
            center_id, sort=sort, limit=limit, **filters,
        )
