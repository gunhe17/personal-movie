from ..events import AssessmentSessionAtomic
from ..repository import AssessmentSessionRepository


class DeleteSessionsByCaseService:
    def __init__(
        self,
        repo: AssessmentSessionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
    ) -> tuple[list[AssessmentSessionAtomic], int]:
        # persist
        removed = await self.repo.remove_by_case(case_id=case_id)

        # return
        atomics = [AssessmentSessionAtomic.deleted(session=s)[0] for s in removed]
        return atomics, len(removed)
