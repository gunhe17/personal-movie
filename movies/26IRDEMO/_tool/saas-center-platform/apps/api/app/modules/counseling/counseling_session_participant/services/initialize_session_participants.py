from app.core.exceptions import InvalidOperationException
from ..events import SessionParticipantAtomic
from ..repository import CounselingSessionParticipantRepository
from ..models import CounselingSessionParticipant
from ...facade.schemas import CaseParticipantDTO


class InitializeSessionParticipantsService:
    def __init__(self, repo: CounselingSessionParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        session_id: str,
        case_participants: list[CaseParticipantDTO],
    ) -> tuple[list[SessionParticipantAtomic], list[CounselingSessionParticipant]]:
        if not case_participants:
            raise InvalidOperationException("No active participants in case")

        # mutate
        atomics: list[SessionParticipantAtomic] = []
        session_participants: list[CounselingSessionParticipant] = []

        for cp in case_participants:
            if not cp.is_active or cp.left_at is not None:
                continue

            session_participant = await self.repo.add(
                center_id=center_id,
                session_id=session_id,
                participant_type=cp.participant_type,
                participant_id=cp.participant_id,
                attendance_status="scheduled",
                attended_at=None,
            )
            atomic, session_participant = SessionParticipantAtomic.added(
                participant=session_participant
            )
            atomics.append(atomic)
            session_participants.append(session_participant)

        return atomics, session_participants
