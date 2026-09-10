from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class ListTasksByFiltersService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        execution_method: str | None = None,
        status_list: list[str] | None = None,
        case_status: str | None = None,
    ) -> list[AssessmentTask]:
        # return
        return await self.repo.list_in_center_with_filters(
            center_id=center_id,
            execution_method=execution_method,
            status_list=status_list,
            case_status=case_status,
        )
