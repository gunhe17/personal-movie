from ..models import TaskStatus
from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.core.type import unset
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class RefuseTaskService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(
        self,
        task_id: str,
        reason: str | None = None,
    ) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # load
        task = await self.repo.get_by_id(task_id=task_id)

        # verify
        if task.status not in ["pending", "in_progress"]:
            raise InvalidOperationException(
                f"대기 중이거나 진행 중인 검사만 거부할 수 있습니다 (status={task.status})"
            )

        # mutate
        process = unset
        if reason:
            process = task.process or {}
            process["refused_reason"] = reason
            process["refused_at"] = utc_now().isoformat()

        task = await self.repo.update_task(
            task_id=task_id,
            status=TaskStatus.REFUSED,
            process=process,
        )
        return AssessmentTaskAtomic.refused(task=task)
