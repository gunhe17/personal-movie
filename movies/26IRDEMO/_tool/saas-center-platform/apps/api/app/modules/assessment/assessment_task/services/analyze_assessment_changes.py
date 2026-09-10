from ..models import TaskStatus
from ...assessment_case.schemas import ConflictDetail
from ..repository import AssessmentTaskRepository


class AnalyzeAssessmentChangesService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(
        self,
        case,
        new_assessment_ids: list[str],
    ) -> tuple[list, list, dict]:
        conflicts = []
        warnings = []
        affected = {
            "tasks_to_cancel": [],
            "tasks_to_create": [],
        }

        # assessment_summary 항목은 스키마에서 id 필드 사용 (AssessmentSummary.id)
        current_assessment_ids = [
            s.get("id") or s.get("assessment_id")
            for s in (case.assessment_summary or [])
            if s.get("id") or s.get("assessment_id")
        ]
        removed = set(current_assessment_ids) - set(new_assessment_ids)
        added = set(new_assessment_ids) - set(current_assessment_ids)

        # load
        if removed:
            tasks = await self.repo.list_by_case(case_id=case.id)
            for task in tasks:
                if task.assessment_id not in removed:
                    continue

                if task.status == TaskStatus.IN_PROGRESS:
                    conflicts.append(ConflictDetail(
                        conflict_type="task_in_progress",
                        resource_id=task.id,
                        resource_name=f"검사 수행 ({task.assessment_id})",
                        current_status=task.status,
                        message="진행 중인 검사가 있어 수정할 수 없습니다. 검사를 먼저 완료하거나 취소해 주세요."
                    ))

                elif task.status == TaskStatus.PENDING:
                    affected["tasks_to_cancel"].append(task.assessment_id)

        if added:
            affected["tasks_to_create"].extend(list(added))

        if affected["tasks_to_cancel"]:
            warnings.append({
                "type": "task_auto_cancel",
                "count": len(affected["tasks_to_cancel"]),
                "message": f"{len(affected['tasks_to_cancel'])}개의 검사가 자동으로 취소됩니다"
            })

        if affected["tasks_to_create"]:
            warnings.append({
                "type": "task_auto_create",
                "count": len(affected["tasks_to_create"]),
                "message": f"{len(affected['tasks_to_create'])}개의 검사가 자동으로 생성됩니다"
            })

        return conflicts, warnings, affected
