from ..models import AssessmentTask
from ..repository import AssessmentTaskRepository


class MarkReportsVisibleToGuardianService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(self, *, case_id: str) -> list[AssessmentTask]:
        # load — 알림톡 열람 링크가 수집하는 집합과 같아야 한다(SendResultFacade.verify_and_collect_reports)
        tasks = await self.repo.list_by_case(case_id=case_id)
        targets = [
            task
            for task in tasks
            if task.status == "completed"
            and task.report_document_id
            and not task.is_report_visible_to_guardian
        ]

        # return
        updated = []
        for task in targets:
            result = await self.repo.update_task(
                task.id,
                is_report_visible_to_guardian=True,
            )
            if result:
                updated.append(result)
        return updated
