from app.core.exceptions import InvalidOperationException
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask
from ..workflows import registry


class SubmitWithWorkflowService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(
        self,
        task: AssessmentTask,
        workflow_type: str,
        data: dict,
    ) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # load
        if not registry.has(workflow_type):
            raise InvalidOperationException(
                f"지원하지 않는 워크플로우 타입: {workflow_type}"
            )

        workflow = registry.get(workflow_type)

        # verify (submitted/completed 허용: 재제출/재업로드 지원)
        if task.status not in ["in_progress", "pending", "submitted", "completed"]:
            raise InvalidOperationException(
                f"제출 불가능한 상태: {task.status}"
            )

        # mutate
        task = await workflow.on_submit(task, data)

        submitted = await self.repo.update_task(
            task_id=task.id,
            status=task.status,
            process=task.process,
            completed_at=task.completed_at,
            report_document_id=task.report_document_id,
            report_payload=task.report_payload,
        )

        # return
        return AssessmentTaskAtomic.submitted(task=submitted)
