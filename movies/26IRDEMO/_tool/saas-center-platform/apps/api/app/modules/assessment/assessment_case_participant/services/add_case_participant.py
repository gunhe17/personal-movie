from app.core.exceptions import ConflictException
from ..events import AssessmentCaseParticipantAtomic
from ..repository import AssessmentCaseParticipantRepository
from ..models import AssessmentCaseParticipant


class AddCaseParticipantService:
    def __init__(self, repo: AssessmentCaseParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
        participant_type: str,
        participant_id: str,
    ) -> tuple[AssessmentCaseParticipantAtomic, AssessmentCaseParticipant]:
        # verify
        existing = await self.repo.find_active(
            case_id=case_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )
        if existing and existing.unassigned_at is None:
            raise ConflictException(
                f"이미 참여 중인 참여자입니다 (case_id={case_id}, "
                f"participant_type={participant_type}, participant_id={participant_id})"
            )

        # persist
        participant = await self.repo.add_or_reassign(
            center_id=center_id,
            case_id=case_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )

        return AssessmentCaseParticipantAtomic.added(participant=participant)
