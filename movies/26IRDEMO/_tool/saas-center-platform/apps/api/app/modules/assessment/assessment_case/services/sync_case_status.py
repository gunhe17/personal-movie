from app.core.datetime_utils import utc_now

from ..models import CaseStatus
from ..events import AssessmentCaseAtomic
from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase
from app.modules.assessment.assessment_task.repository import AssessmentTaskRepository


class SyncCaseStatusService:
    # task 상태 합산으로 case 상태를 유도하는 한 불변식 — task repo는 부속 repo 예외(service.md §4)
    def __init__(
        self,
        repo: AssessmentCaseRepository,
        task_repo: AssessmentTaskRepository,
    ):
        self.repo = repo
        self.task_repo = task_repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
    ) -> tuple[AssessmentCaseAtomic | None, AssessmentCase]:
        # load
        case = await self.repo.get_in_center(center_id=center_id, case_id=case_id)
        tasks = await self.task_repo.list_by_case(case_id=case_id)

        if not tasks:
            return None, case

        # compute
        task_statuses = [task.status for task in tasks]
        total = len(task_statuses)
        completed_count = task_statuses.count("completed")
        in_progress_count = task_statuses.count("in_progress")
        submitted_count = task_statuses.count("submitted")
        refused_count = task_statuses.count("refused")
        cancelled_count = task_statuses.count("cancelled")
        pending_count = task_statuses.count("pending")

        # submitted는 아직 검수 완료 전 → "진행 중"으로 취급
        active_count = in_progress_count + submitted_count
        finished_count = completed_count + refused_count + cancelled_count
        all_finished = finished_count == total

        if completed_count == total:
            if case.is_final_report_required and not case.documents:
                # 종합보고서 필요하지만 아직 없음 → 완료로 보지 않고 processing 유지
                new_status = CaseStatus.PROCESSING
            else:
                new_status = "completed"
        elif all_finished and completed_count == 0:
            new_status = "cancelled"
        elif active_count > 0:
            new_status = CaseStatus.PROCESSING
        elif pending_count == total:
            new_status = "pending"
        else:
            new_status = CaseStatus.PROCESSING

        # update (무변경 = 사실 없음 → atomic None)
        if new_status == case.status:
            return None, case

        if new_status == "completed" and not case.completed_at:
            updated = await self.repo.update_in_center(
                case_id=case.id,
                center_id=case.center_id,
                status=new_status,
                completed_at=utc_now(),
            )
        else:
            updated = await self.repo.update_in_center(
                case_id=case.id,
                center_id=case.center_id,
                status=new_status,
            )

        # return
        return AssessmentCaseAtomic.updated(
            case=updated, changed={"status": str(new_status)}
        )
