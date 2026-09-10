from ..repository import CounselingCaseParticipantRepository
from ..models import CounselingCaseParticipant


class GetParticipantService:
    def __init__(self, participant_repo: CounselingCaseParticipantRepository):
        self.participant_repo = participant_repo

    async def execute(
        self,
        participant_id: str,
        center_id: str
    ) -> CounselingCaseParticipant:
        participant = await self.participant_repo.get_in_center(
            participant_id=participant_id,
            center_id=center_id,
        )
        return participant
