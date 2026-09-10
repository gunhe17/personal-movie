from app.modules.assessment.assessment_task.models import TaskStatus
from app.core.datetime_utils import utc_now
from ...models import AssessmentTask
from ..exceptions import WorkflowValidationError


class ExternalServiceWorkflow:
    WORKFLOW_TYPE = "external_service"
    NAME = "외부 서비스형 검사"

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
            "workflow_type": "external_service",
            "requires_external_url": True,
        }

    async def on_submit(
        self,
        task: AssessmentTask,
        data: dict
    ) -> AssessmentTask:
        report_document_id = data.get("report_document_id")
        report_payload = data.get("report_payload")

        if not report_document_id:
            raise WorkflowValidationError("report_document_id is required")

        task.report_document_id = report_document_id
        task.report_payload = report_payload

        task.process = task.process or {}
        task.process["uploaded_at"] = utc_now().isoformat()

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
            return ["upload_report", "refuse", "cancel"]
        elif task.status == TaskStatus.SUBMITTED:
            return ["complete", "view_report", "cancel"]
        elif task.status == TaskStatus.COMPLETED:
            return ["view_report", "revert", "cancel"]
        return []


from ..registry import registry
registry.register(ExternalServiceWorkflow)
