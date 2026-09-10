from ..events import AssessmentCaseParticipantAtomic
from ..repository import AssessmentCaseParticipantRepository


class UnassignCaseParticipantsService:
    def __init__(
        self,
        repo: AssessmentCaseParticipantRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        participants_to_unassign: list[dict],
    ) -> tuple[list[AssessmentCaseParticipantAtomic], list[dict]]:
        atomics: list[AssessmentCaseParticipantAtomic] = []
        unassigned = []

        # apply (repo.unassign = active 행만 매칭·전이)
        for p in participants_to_unassign:
            record = await self.repo.update_unassigned(
                case_id=case_id,
                participant_type=p["type"],
                participant_id=p["id"],
            )
            if record is not None:
                atomic, _ = AssessmentCaseParticipantAtomic.removed(participant=record)
                atomics.append(atomic)
                unassigned.append(p)

        return atomics, unassigned
