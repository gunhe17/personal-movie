from dataclasses import dataclass
from ..repository import AssessmentTaskRepository


@dataclass
class TaskProgressInfo:
    total_count: int
    completed_count: int


class GetTaskProgressBulkService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(self, case_ids: list[str]) -> dict[str, TaskProgressInfo]:
        if not case_ids:
            return {}

        rows = await self.repo.aggregate_progress_by_case_ids(case_ids=case_ids)

        return {
            row.case_id: TaskProgressInfo(
                total_count=row.total_count,
                completed_count=row.completed_count,
            )
            for row in rows
        }
