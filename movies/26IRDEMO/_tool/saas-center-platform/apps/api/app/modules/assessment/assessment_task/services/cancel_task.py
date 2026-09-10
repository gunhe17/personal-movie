from ..models import TaskStatus
from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class CancelTaskService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(
        self,
        task_id: str,
        reason: str | None = None,
    ) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # load
        task = await self.repo.get_by_id(task_id=task_id)

        # 이미 취소된 경우: 상태는 그대로 두고 취소 사유만 갱신
        # (모바일에서 '즉시 중단' 후 중단 사유를 이어서 입력·수정하는 흐름 지원)
        if task.status == TaskStatus.CANCELLED:
            process = dict(task.process) if task.process else {}
            if reason is not None:
                process["cancelled_reason"] = reason
            task = await self.repo.update_task(task_id=task_id, process=process)
            return AssessmentTaskAtomic.cancelled(task=task)

        # verify
        if task.status not in ["pending", "in_progress", "submitted", "completed"]:
            raise InvalidOperationException(
                f"취소할 수 없는 상태입니다 (status={task.status})"
            )

        # mutate (되돌리기 대비 이전 상태 저장)
        process = dict(task.process) if task.process else {}
        process["previous_status"] = task.status
        if reason:
            process["cancelled_reason"] = reason
        process["cancelled_at"] = utc_now().isoformat()

        task = await self.repo.update_task(
            task_id=task_id,
            status=TaskStatus.CANCELLED,
            process=process,
        )
        return AssessmentTaskAtomic.cancelled(task=task)
