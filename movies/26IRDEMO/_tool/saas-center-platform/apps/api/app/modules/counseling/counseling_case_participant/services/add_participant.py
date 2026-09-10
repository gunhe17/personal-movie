from app.core.exceptions import ConflictException
from ..repository import CounselingCaseParticipantRepository
from ..models import CounselingCaseParticipant
from ..events import CaseParticipantAtomic
from app.core.datetime_utils import utc_now


class AddParticipantService:
    def __init__(self, participant_repo: CounselingCaseParticipantRepository):
        self.participant_repo = participant_repo

    async def execute(
        self,
        *,
        case_id: str,
        center_id: str,
        participant_id: str,
        participant_type: str,
    ) -> tuple[CaseParticipantAtomic, CounselingCaseParticipant]:
        # verify
        existing = await self.participant_repo.find_active_participant(
            case_id=case_id,
            participant_id=participant_id,
        )
        if existing and existing.participant_type == participant_type:
            raise ConflictException(
                f"Participant already exists in this case: {participant_id}"
            )

        # add
        participant = await self.participant_repo.add(
            center_id=center_id,
            counseling_case_id=case_id,
            participant_id=participant_id,
            participant_type=participant_type,
            is_active=True,
            joined_at=utc_now(),
        )

        # return
        return CaseParticipantAtomic.added(participant=participant)
