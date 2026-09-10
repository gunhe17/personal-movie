from ..events import AssessmentCaseParticipantAtomic
from ..repository import AssessmentCaseParticipantRepository
from ..models import AssessmentCaseParticipant


class CreateCaseParticipantSimpleService:
    # 중복 검증 없음 — 검증 경로는 AddCaseParticipantService
    def __init__(
        self,
        repo: AssessmentCaseParticipantRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        case_id: str,
        participant_type: str,
        participant_id: str,
    ) -> tuple[AssessmentCaseParticipantAtomic, AssessmentCaseParticipant]:
        participant = await self.repo.add_or_reassign(
            center_id=center_id,
            case_id=case_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )

        # return
        return AssessmentCaseParticipantAtomic.added(participant=participant)
