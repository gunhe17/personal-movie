from ..models import TaskStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class RevertCancelTaskService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(self, task_id: str) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # load
        task = await self.repo.get_by_id(task_id=task_id)

        # verify
        if task.status != TaskStatus.CANCELLED:
            raise InvalidOperationException(
                f"취소된 검사만 롤백할 수 있습니다 (현재 상태: {task.status})"
            )

        # mutate
        process = dict(task.process) if task.process else {}
        previous_status = process.pop("previous_status", "pending")
        process.pop("cancelled_reason", None)
        process.pop("cancelled_at", None)

        reverted = await self.repo.update_task(
            task_id=task_id,
            status=previous_status,
            process=process,
        )

        # return
        return AssessmentTaskAtomic.cancel_reverted(task=reverted)
