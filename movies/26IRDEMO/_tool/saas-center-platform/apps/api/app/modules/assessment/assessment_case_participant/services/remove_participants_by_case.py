from ..events import AssessmentCaseParticipantAtomic
from ..repository import AssessmentCaseParticipantRepository


class RemoveParticipantsByCaseService:
    def __init__(
        self,
        repo: AssessmentCaseParticipantRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
    ) -> tuple[list[AssessmentCaseParticipantAtomic], int]:
        # persist
        removed = await self.repo.remove_by_case(case_id=case_id)

        # return
        atomics = [
            AssessmentCaseParticipantAtomic.removed(participant=p)[0] for p in removed
        ]
        return atomics, len(removed)
