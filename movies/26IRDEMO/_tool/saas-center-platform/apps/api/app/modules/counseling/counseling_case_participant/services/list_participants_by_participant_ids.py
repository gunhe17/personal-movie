from ..repository import CounselingCaseParticipantRepository
from ..models import CounselingCaseParticipant


class ListParticipantsByParticipantIdsService:
    def __init__(self, participant_repo: CounselingCaseParticipantRepository):
        self.participant_repo = participant_repo

    async def execute(
        self,
        participant_ids: list[str],
        center_id: str,
        active_only: bool = False,
        participant_type: str | None = None,
    ) -> list[CounselingCaseParticipant]:
        return await self.participant_repo.list_by_participant_ids(
            participant_ids=participant_ids,
            center_id=center_id,
            active_only=active_only,
            participant_type=participant_type,
        )
