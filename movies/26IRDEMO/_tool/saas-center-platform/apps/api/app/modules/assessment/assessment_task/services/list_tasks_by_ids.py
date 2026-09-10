from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class ListTasksByIdsService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(self, task_ids: list[str]) -> list[AssessmentTask]:
        # return
        return await self.repo.list_by_ids(task_ids)
