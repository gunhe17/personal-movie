from app.core.exceptions import EntityNotFoundException
from ..events import AssessmentCaseParticipantAtomic
from ..repository import AssessmentCaseParticipantRepository
from ..models import AssessmentCaseParticipant


class RemoveCaseParticipantService:
    def __init__(self, repo: AssessmentCaseParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        participant_type: str,
        participant_id: str,
    ) -> tuple[AssessmentCaseParticipantAtomic, AssessmentCaseParticipant]:
        # command
        participant = await self.repo.update_unassigned(
            case_id=case_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )

        # verify
        if not participant:
            raise EntityNotFoundException(
                f"참여자를 찾을 수 없습니다 (case_id={case_id}, "
                f"participant_type={participant_type}, participant_id={participant_id})"
            )

        return AssessmentCaseParticipantAtomic.removed(participant=participant)
