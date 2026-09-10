from ..models import TaskStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class StartTaskService:
    def __init__(
        self,
        repo: AssessmentTaskRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        task_id: str,
    ) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # load
        task = await self.repo.get_by_id(task_id=task_id)

        # verify
        if task.status != TaskStatus.PENDING:
            raise InvalidOperationException(
                f"대기 상태의 검사만 시작할 수 있습니다 (status={task.status})"
            )

        # persist
        started = await self.repo.update_task(
            task_id=task_id, status=TaskStatus.IN_PROGRESS
        )

        # return
        return AssessmentTaskAtomic.started(task=started)
