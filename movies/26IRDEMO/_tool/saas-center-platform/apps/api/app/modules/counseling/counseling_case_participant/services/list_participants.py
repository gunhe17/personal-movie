from ..repository import CounselingCaseParticipantRepository
from ..models import CounselingCaseParticipant


class ListParticipantsService:
    def __init__(self, participant_repo: CounselingCaseParticipantRepository):
        self.participant_repo = participant_repo

    async def execute(
        self,
        case_id: str,
        center_id: str,
        active_only: bool = False,
        participant_type: str | None = None,
    ) -> list[CounselingCaseParticipant]:
        return await self.participant_repo.list_by_case(
            case_id=case_id,
            center_id=center_id,
            active_only=active_only,
            participant_type=participant_type,
        )
