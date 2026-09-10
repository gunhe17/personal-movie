from ..repository import CounselingSessionParticipantRepository
from ..models import CounselingSessionParticipant
from ..events import SessionParticipantAtomic


class RemoveSessionParticipantService:
    def __init__(self, repo: CounselingSessionParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        session_participant_id: str,
        center_id: str,
    ) -> tuple[SessionParticipantAtomic, CounselingSessionParticipant]:
        # load
        participant = await self.repo.get_in_center(
            id=session_participant_id,
            center_id=center_id,
        )

        # mutate
        removed = await self.repo.remove_by_id(participant.id)

        # return
        return SessionParticipantAtomic.removed(
            participant=removed if removed is not None else participant
        )
