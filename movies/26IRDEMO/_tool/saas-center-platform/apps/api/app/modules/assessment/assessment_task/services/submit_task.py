from ..models import TaskStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class SubmitTaskService:
    def __init__(
        self,
        repo: AssessmentTaskRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        task_id: str,
        responses: list[dict],
    ) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # load
        task = await self.repo.get_by_id(task_id=task_id)

        # verify ("processing"은 case status — task엔 없는 값이라 제거)
        if task.status != TaskStatus.IN_PROGRESS:
            raise InvalidOperationException(
                f"진행 중인 검사에만 응답을 제출할 수 있습니다 (status={task.status})"
            )

        # mutate
        process = task.process or {}
        process["responses"] = responses
        process["progress"] = len(responses)

        updated = await self.repo.update_task(task_id=task_id, process=process)

        # return (응답 원문은 delta에 싣지 않는다 — 진행 건수만)
        return AssessmentTaskAtomic.updated(
            task=updated, changed={"progress": len(responses)}
        )
