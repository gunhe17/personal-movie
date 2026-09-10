from ..repository import AssessmentCaseParticipantRepository
from ..models import AssessmentCaseParticipant


class ListParticipantsByParticipantIdsService:
    def __init__(self, repo: AssessmentCaseParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        participant_ids: list[str],
        center_id: str,
        participant_type: str | None = None,
        active_only: bool = True,
    ) -> list[AssessmentCaseParticipant]:
        return await self.repo.list_by_participant_ids(
            participant_ids=participant_ids,
            center_id=center_id,
            participant_type=participant_type,
            active_only=active_only,
        )
