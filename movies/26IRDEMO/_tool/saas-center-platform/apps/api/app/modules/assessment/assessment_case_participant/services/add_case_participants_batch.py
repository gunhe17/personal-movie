from app.core.exceptions import ConflictException
from ..events import AssessmentCaseParticipantAtomic
from ..repository import AssessmentCaseParticipantRepository
from ..models import AssessmentCaseParticipant


class AddCaseParticipantsBatchService:
    def __init__(
        self,
        repo: AssessmentCaseParticipantRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
        client_ids: list[str],
        assistant_ids: list[str] | None = None,
    ) -> tuple[list[AssessmentCaseParticipantAtomic], list[AssessmentCaseParticipant]]:
        atomics: list[AssessmentCaseParticipantAtomic] = []
        participants: list[AssessmentCaseParticipant] = []

        # clients
        for client_id in client_ids:
            existing = await self.repo.find_active(
                case_id=case_id,
                participant_type="client",
                participant_id=client_id,
            )
            if existing and existing.unassigned_at is None:
                raise ConflictException(
                    f"이미 참여 중인 내담자입니다 (client_id={client_id})"
                )

            participant = await self.repo.add_or_reassign(
                center_id=center_id,
                case_id=case_id,
                participant_type="client",
                participant_id=client_id,
            )
            atomic, _ = AssessmentCaseParticipantAtomic.added(participant=participant)
            atomics.append(atomic)
            participants.append(participant)

        # assistants
        if assistant_ids:
            for assistant_id in assistant_ids:
                existing = await self.repo.find_active(
                    case_id=case_id,
                    participant_type="assistant",
                    participant_id=assistant_id,
                )
                if existing and existing.unassigned_at is None:
                    raise ConflictException(
                        f"이미 참여 중인 보조 검사자입니다 (assistant_id={assistant_id})"
                    )

                participant = await self.repo.add_or_reassign(
                    center_id=center_id,
                    case_id=case_id,
                    participant_type="assistant",
                    participant_id=assistant_id,
                )
                atomic, _ = AssessmentCaseParticipantAtomic.added(
                    participant=participant
                )
                atomics.append(atomic)
                participants.append(participant)

        return atomics, participants
