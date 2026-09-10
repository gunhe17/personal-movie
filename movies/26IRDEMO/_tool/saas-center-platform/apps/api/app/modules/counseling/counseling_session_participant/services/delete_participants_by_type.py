from ..events import SessionParticipantAtomic
from ..repository import CounselingSessionParticipantRepository


class DeleteSessionParticipantsByTypeService:
    def __init__(self, participant_repo: CounselingSessionParticipantRepository):
        self.participant_repo = participant_repo

    async def execute(
        self,
        session_id: str,
        participant_type: str,
    ) -> tuple[list[SessionParticipantAtomic], int]:
        # remove
        participants = await self.participant_repo.remove_by_session_and_type(
            session_id=session_id,
            participant_type=participant_type,
        )

        # return
        atomics = [
            SessionParticipantAtomic.removed(participant=p)[0] for p in participants
        ]
        return atomics, len(atomics)
