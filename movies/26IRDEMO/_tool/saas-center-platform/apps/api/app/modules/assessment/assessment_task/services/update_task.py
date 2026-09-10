from datetime import datetime

from app.core.type import unset, utc_dt

from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class UpdateTaskService:
    def __init__(
        self,
        repo: AssessmentTaskRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        task: AssessmentTask,
        *,
        status: str = unset,
        process: dict = unset,
        completed_at: utc_dt | None = unset,
        report_payload: dict | None = unset,
        report_document_id: str | None = unset,
        opinion: str | None = unset,
    ) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        # persist
        updated = await self.repo.update_task(
            task_id=task.id,
            status=status,
            process=process,
            completed_at=completed_at,
            report_payload=report_payload,
            report_document_id=report_document_id,
            opinion=opinion,
        )
        model = updated if updated is not None else task

        # compute (delta = 전달된 필드만, JSON-safe)
        changed = {
            k: (v.isoformat() if isinstance(v, datetime) else v)
            for k, v in {
                "status": status,
                "process": process,
                "completed_at": completed_at,
                "report_payload": report_payload,
                "report_document_id": report_document_id,
                "opinion": opinion,
            }.items()
            if v is not unset
        }

        # return
        return AssessmentTaskAtomic.updated(task=model, changed=changed)
