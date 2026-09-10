from app.core.exceptions import EntityNotFoundException

from ..repository import CounselingSessionParticipantRepository
from ..models import CounselingSessionParticipant


class GetSessionParticipantByIdService:
    def __init__(self, repo: CounselingSessionParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        session_participant_id: str,
        center_id: str,
    ) -> CounselingSessionParticipant:
        # load
        participant = await self.repo.get_by_id(id=session_participant_id)

        # verify (센터 스코프)
        if participant.center_id != center_id:
            raise EntityNotFoundException(
                f"CounselingSessionParticipant not found: {session_participant_id}"
            )

        # return
        return participant
