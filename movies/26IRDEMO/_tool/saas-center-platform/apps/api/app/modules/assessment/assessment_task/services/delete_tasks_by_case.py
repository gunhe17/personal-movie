from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository


class DeleteTasksByCaseService:
    def __init__(
        self,
        repo: AssessmentTaskRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
    ) -> tuple[list[AssessmentTaskAtomic], int]:
        # persist
        removed = await self.repo.remove_by_case(case_id=case_id)

        # return
        atomics = [AssessmentTaskAtomic.deleted(task=t)[0] for t in removed]
        return atomics, len(removed)
