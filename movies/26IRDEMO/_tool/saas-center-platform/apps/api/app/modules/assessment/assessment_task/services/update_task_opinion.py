from app.core.exceptions import PermissionDeniedException
from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class UpdateTaskOpinionService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(
        self,
        task_id: str,
        center_id: str,
        opinion: str | None,
    ) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        task = await self.repo.get_by_id(task_id=task_id)
        if task.center_id != center_id:
            raise PermissionDeniedException("권한 없음")

        normalized = opinion.strip() if opinion else None
        if normalized == "":
            normalized = None

        updated = await self.repo.update_task(task_id=task_id, opinion=normalized)
        return AssessmentTaskAtomic.updated(task=updated, changed={"opinion": normalized})
