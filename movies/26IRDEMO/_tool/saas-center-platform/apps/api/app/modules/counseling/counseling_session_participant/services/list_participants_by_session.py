from ..repository import CounselingSessionParticipantRepository
from ..models import CounselingSessionParticipant


class ListParticipantsBySessionService:
    def __init__(self, participant_repo: CounselingSessionParticipantRepository):
        self.participant_repo = participant_repo

    async def execute(
        self,
        session_id: str,
        center_id: str,
    ) -> list[CounselingSessionParticipant]:
        participants = await self.participant_repo.list_by_session(session_id=session_id)

        return [p for p in participants if p.center_id == center_id]
