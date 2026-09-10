from app.core.exceptions import EntityNotFoundException

from ...counseling_case_participant.repository import (
    CounselingCaseParticipantRepository,
)
from ...counseling_case_participant.schemas import CaseParticipantType
from ..repository import CounselingCaseRepository


class VerifyCaseReadableService:
    def __init__(
        self,
        case_repo: CounselingCaseRepository,
        participant_repo: CounselingCaseParticipantRepository,
    ):
        self.case_repo = case_repo
        self.participant_repo = participant_repo

    async def execute(
        self,
        case_id: str,
        center_id: str,
        *,
        member_id: str | None,
    ) -> None:
        # member_id None = access_level=all (센터 전체 열람)
        if member_id is None:
            return

        # load
        case = await self.case_repo.get_in_center(
            case_id=case_id,
            center_id=center_id,
        )
        if case.counselor_id == member_id:
            return

        # verify
        participants = await self.participant_repo.list_by_case(
            case_id=case_id,
            center_id=center_id,
            active_only=True,
            participant_type=CaseParticipantType.COUNSELOR.value,
        )
        if any(p.participant_id == member_id for p in participants):
            return

        raise EntityNotFoundException(f"CounselingCase not found: {case_id}")
