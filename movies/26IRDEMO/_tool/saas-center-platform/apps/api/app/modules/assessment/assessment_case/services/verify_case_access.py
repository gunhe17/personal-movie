from app.core.exceptions import EntityNotFoundException

from ...assessment_case_participant.repository import (
    AssessmentCaseParticipantRepository,
)
from ..repository import AssessmentCaseRepository


class VerifyCaseAccessService:
    def __init__(
        self,
        case_repo: AssessmentCaseRepository,
        participant_repo: AssessmentCaseParticipantRepository,
    ):
        self.case_repo = case_repo
        self.participant_repo = participant_repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
        *,
        member_id: str | None,
        writable: bool = False,
    ) -> None:
        # member_id None = access_level=all (센터 전체)
        if member_id is None:
            return

        # load
        case = await self.case_repo.get_in_center(
            center_id=center_id,
            case_id=case_id,
        )
        if case.counselor_id == member_id:
            return

        # 참여 검사자는 열람만 — 수정은 주담당 전용
        if writable:
            raise EntityNotFoundException(f"AssessmentCase not found: {case_id}")

        # verify
        participants = await self.participant_repo.list_by_case_and_type(
            case_id=case_id,
            participant_type="assistant",
        )
        if any(p.participant_id == member_id for p in participants):
            return

        raise EntityNotFoundException(f"AssessmentCase not found: {case_id}")
