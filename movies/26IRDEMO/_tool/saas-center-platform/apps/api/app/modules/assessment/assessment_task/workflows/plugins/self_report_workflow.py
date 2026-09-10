from app.modules.assessment.assessment_task.models import TaskStatus
from app.core.datetime_utils import utc_now
from ...models import AssessmentTask


class SelfReportWorkflow:
    WORKFLOW_TYPE = "self_report"
    NAME = "자가응답형 검사"

    @property
    def workflow_type(self) -> str:
        return self.WORKFLOW_TYPE

    @property
    def name(self) -> str:
        return self.NAME

    def validate_start(self, task: AssessmentTask) -> bool:
        return task.status == TaskStatus.PENDING

    async def on_start(self, task: AssessmentTask) -> dict:
        return {
            "workflow_type": "self_report",
            "requires_questions": True,
        }

    async def on_submit(
        self,
        task: AssessmentTask,
        data: dict
    ) -> AssessmentTask:
        responses = data.get("responses", [])
        current_item = data.get("current_item")

        task.process = task.process or {}
        task.process["responses"] = responses
        task.process["submitted_at"] = utc_now().isoformat()

        if current_item is not None:
            task.process["current_item"] = current_item

        task.status = TaskStatus.SUBMITTED
        task.completed_at = None

        return task

    async def on_complete(self, task: AssessmentTask) -> AssessmentTask:
        task.status = TaskStatus.COMPLETED
        task.completed_at = utc_now()
        return task

    def get_available_actions(self, task: AssessmentTask) -> list[str]:
        if task.status == TaskStatus.PENDING:
            return ["start", "refuse", "cancel"]
        elif task.status == TaskStatus.IN_PROGRESS:
            return ["submit", "refuse", "cancel"]
        elif task.status == TaskStatus.SUBMITTED:
            return ["complete", "view_report", "cancel"]
        elif task.status == TaskStatus.COMPLETED:
            return ["view_report", "revert", "cancel"]
        return []


from ..registry import registry
registry.register(SelfReportWorkflow)
