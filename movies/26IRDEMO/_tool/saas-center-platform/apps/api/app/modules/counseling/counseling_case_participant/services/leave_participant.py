from app.core.exceptions import InvalidOperationException
from ..repository import CounselingCaseParticipantRepository
from ..models import CounselingCaseParticipant
from ..events import CaseParticipantAtomic
from app.core.datetime_utils import utc_now


class LeaveParticipantService:
    def __init__(self, participant_repo: CounselingCaseParticipantRepository):
        self.participant_repo = participant_repo

    async def execute(
        self,
        participant_id: str,
        center_id: str
    ) -> tuple[CaseParticipantAtomic, CounselingCaseParticipant]:
        # load
        participant = await self.participant_repo.get_in_center(
            participant_id=participant_id,
            center_id=center_id,
        )

        # verify
        if not participant.is_active:
            raise InvalidOperationException("Participant already left")

        active_count = await self.participant_repo.count_active(
            case_id=participant.counseling_case_id,
        )
        if active_count <= 1:
            raise InvalidOperationException(
                "Cannot remove the last participant. "
                "케이스에는 최소 1명의 참여자가 필요합니다. "
                "새로운 참여자를 먼저 추가하거나 케이스를 종결/취소하세요."
            )

        # save
        updated = await self.participant_repo.update_in_center(
            participant_id=participant_id,
            center_id=center_id,
            is_active=False,
            left_at=utc_now(),
        )
        assert updated is not None
        return CaseParticipantAtomic.left(participant=updated)
