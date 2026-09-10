from ..models import TaskStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class DeleteTaskService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(self, task_id: str) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # load
        task = await self.repo.get_by_id(task_id=task_id)

        # verify
        if task.status == TaskStatus.COMPLETED:
            raise InvalidOperationException(
                "완료된 검사는 삭제할 수 없습니다 (채점 결과 보존)"
            )

        # persist
        removed = await self.repo.remove_by_id(task_id)

        # return
        return AssessmentTaskAtomic.deleted(task=removed if removed is not None else task)
