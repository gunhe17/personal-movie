from ..repository import AssessmentCaseParticipantRepository
from ..models import AssessmentCaseParticipant


class ListParticipantsByCaseAndTypeService:
    def __init__(self, repo: AssessmentCaseParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        participant_type: str,
    ) -> list[AssessmentCaseParticipant]:
        # return
        return await self.repo.list_by_case_and_type(
            case_id=case_id,
            participant_type=participant_type,
        )
