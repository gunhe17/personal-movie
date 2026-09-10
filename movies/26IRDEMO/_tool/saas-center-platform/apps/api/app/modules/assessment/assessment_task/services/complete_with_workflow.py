from ..models import TaskStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask
from ..workflows import registry


class CompleteWithWorkflowService:
    def __init__(
        self,
        repo: AssessmentTaskRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        task: AssessmentTask,
        workflow_type: str,
    ) -> tuple[AssessmentTaskAtomic | None, AssessmentTask]:
        # load
        if not registry.has(workflow_type):
            raise InvalidOperationException(
                f"지원하지 않는 워크플로우 타입: {workflow_type}"
            )

        workflow = registry.get(workflow_type)

        # verify (이미 완료된 경우 그대로 반환: 재업로드 지원 — 무변경 = atomic None)
        if task.status == TaskStatus.COMPLETED:
            return None, task
        if task.status not in ["in_progress", "pending"]:
            raise InvalidOperationException(f"완료 처리 불가능한 상태: {task.status}")

        # persist
        task = await workflow.on_complete(task)

        completed = await self.repo.update_task(
            task_id=task.id,
            status=task.status,
            completed_at=task.completed_at,
        )

        # return
        return AssessmentTaskAtomic.completed(task=completed)
