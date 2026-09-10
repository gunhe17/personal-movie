from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class ListTasksByCaseService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        execution_method: str | None = None,
    ) -> list[AssessmentTask]:
        return await self.repo.list_by_case(case_id=case_id, execution_method=execution_method)
