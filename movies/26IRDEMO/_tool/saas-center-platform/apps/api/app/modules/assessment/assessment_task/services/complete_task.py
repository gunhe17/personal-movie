from ..models import TaskStatus
from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class CompleteTaskService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(self, task_id: str) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # load
        task = await self.repo.get_by_id(task_id=task_id)

        # verify
        if task.status in ("completed", "cancelled"):
            raise InvalidOperationException(
                f"이미 {task.status} 상태인 검사는 완료 처리할 수 없습니다"
            )

        # persist
        # TODO: Assessment.definition.scoring 기반 채점
        # TODO: report_payload 생성

        # 되돌리기(revert) 시 완료 직전 상태로 복원할 수 있도록 이전 상태 보존
        process = dict(task.process) if task.process else {}
        process["previous_status"] = task.status

        completed = await self.repo.update_task(
            task_id=task_id,
            status=TaskStatus.COMPLETED,
            completed_at=utc_now(),
            process=process,
        )

        # return
        return AssessmentTaskAtomic.completed(task=completed)
