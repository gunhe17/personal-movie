from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository


class RevertCancelTasksByCaseService:
    def __init__(
        self,
        repo: AssessmentTaskRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
    ) -> tuple[list[AssessmentTaskAtomic], int]:
        # load
        tasks = await self.repo.list_cancelled_by_case(case_id=case_id)

        if not tasks:
            return [], 0

        # revert (previous_status 복원 + 취소 흔적 제거)
        atomics: list[AssessmentTaskAtomic] = []
        for task in tasks:
            process = dict(task.process) if task.process else {}
            previous_status = process.pop("previous_status", "pending")
            process.pop("cancelled_reason", None)
            process.pop("cancelled_at", None)
            updated = await self.repo.update_task(
                task_id=task.id,
                status=previous_status,
                process=process,
            )
            atomic, _ = AssessmentTaskAtomic.cancel_reverted(
                task=updated if updated is not None else task
            )
            atomics.append(atomic)

        # return
        return atomics, len(tasks)
