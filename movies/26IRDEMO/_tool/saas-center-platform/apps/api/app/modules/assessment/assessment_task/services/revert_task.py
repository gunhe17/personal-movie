from ..models import TaskStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class RevertTaskService:
    # 검수 되돌리기 (completed → submitted)

    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(self, task_id: str) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # load
        task = await self.repo.get_by_id(task_id=task_id)

        # verify
        if task.status != TaskStatus.COMPLETED:
            raise InvalidOperationException(
                f"완료된 검사만 되돌릴 수 있습니다 (현재 상태: {task.status})"
            )

        # mutate
        #    - 모바일: pending/in_progress 에서 완료 → 되돌리기 시 원래 상태로
        #    - 웹(검수): submitted 에서 완료 → 되돌리기 시 submitted (기존과 동일)
        process = dict(task.process) if task.process else {}
        prev_status = process.pop("previous_status", None) or "submitted"

        reverted = await self.repo.update_task(
            task_id=task_id,
            status=prev_status,
            completed_at=None,
            process=process,
        )

        # return
        return AssessmentTaskAtomic.reverted(task=reverted)
