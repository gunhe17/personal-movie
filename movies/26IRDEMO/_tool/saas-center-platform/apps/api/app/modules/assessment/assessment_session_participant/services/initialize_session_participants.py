from app.core.exceptions import InvalidOperationException
from ..events import AssessmentSessionParticipantAtomic
from ..repository import AssessmentSessionParticipantRepository
from ..models import AssessmentSessionParticipant
from ...facade.schemas import CaseParticipantDTO


class InitializeSessionParticipantsService:
    def __init__(self, repo: AssessmentSessionParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        session_id: str,
        case_participants: list[CaseParticipantDTO],
    ) -> tuple[
        list[AssessmentSessionParticipantAtomic],
        list[AssessmentSessionParticipant],
    ]:
        if not case_participants:
            raise InvalidOperationException("No active participants in case")

        session_participants = []

        for cp in case_participants:
            # 활성 참여자만 (unassigned_at이 None)
            if cp.unassigned_at is not None:
                continue

            session_participant = await self.repo.add(
                center_id=center_id,
                session_id=session_id,
                participant_type=cp.participant_type,
                participant_id=cp.participant_id,
                attendance_status="scheduled",
            )
            session_participants.append(session_participant)

        return [
            AssessmentSessionParticipantAtomic.added(participant=participant)[0]
            for participant in session_participants
        ], session_participants
