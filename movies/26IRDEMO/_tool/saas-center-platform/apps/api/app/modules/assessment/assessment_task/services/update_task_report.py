from app.core.datetime_utils import utc_now
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class UpdateTaskReportService:
    def __init__(
        self,
        repo: AssessmentTaskRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        task: AssessmentTask,
        scores: dict,
        interpretation: dict,
    ) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # compute
        report_payload = {
            "scoring": scores,
            "interpretation": interpretation,
            "scored_at": utc_now().isoformat(),
        }

        # persist
        updated = await self.repo.update_task(
            task_id=task.id,
            report_payload=report_payload,
        )
        model = updated if updated is not None else task

        # return
        return AssessmentTaskAtomic.updated(
            task=model, changed={"report_payload": report_payload}
        )
