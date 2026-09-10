from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class GetTaskByIdService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(self, task_id: str) -> AssessmentTask:
        return await self.repo.get_by_id(task_id=task_id)
