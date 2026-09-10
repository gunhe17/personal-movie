from app.core.exceptions import ConflictException
from ..repository import AssessmentSessionParticipantRepository
from ..models import AssessmentSessionParticipant


class AddSessionParticipantsService:
    def __init__(self, repo: AssessmentSessionParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        session_id: str,
        client_ids: list[str] | None = None,
        assistant_ids: list[str] | None = None,
    ) -> list[AssessmentSessionParticipant]:
        added_participants = []

        if client_ids:
            for client_id in client_ids:
                # verify
                existing = await self.repo.find_one(
                    session_id=session_id,
                    participant_type="client",
                    participant_id=client_id,
                )

                if existing:
                    raise ConflictException(
                        f"Client {client_id} already exists in session {session_id}"
                    )

                participant = await self.repo.add_or_restore(
                    center_id=center_id,
                    session_id=session_id,
                    participant_type="client",
                    participant_id=client_id,
                    attendance_status="scheduled",
                )
                added_participants.append(participant)

        if assistant_ids:
            for assistant_id in assistant_ids:
                # verify
                existing = await self.repo.find_one(
                    session_id=session_id,
                    participant_type="assistant",
                    participant_id=assistant_id,
                )

                if existing:
                    raise ConflictException(
                        f"Assistant {assistant_id} already exists in session {session_id}"
                    )

                participant = await self.repo.add_or_restore(
                    center_id=center_id,
                    session_id=session_id,
                    participant_type="assistant",
                    participant_id=assistant_id,
                    attendance_status="scheduled",
                )
                added_participants.append(participant)

        return added_participants
