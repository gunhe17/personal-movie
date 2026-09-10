from app.core.logger import get_logger
from app.infrastructure.storage import StorageClient
from app.modules.assessment.assessment_case.events import AssessmentCaseAtomic
from app.modules.assessment.assessment_case.repository import AssessmentCaseRepository
from app.modules.assessment.assessment_case.services import (
    FindAssessmentCaseService,
    SyncCaseStatusService,
)
from app.modules.assessment.assessment_case_participant.repository import (
    AssessmentCaseParticipantRepository,
)
from app.modules.assessment.assessment_case_participant.services import (
    ListParticipantsByCaseAndTypeService,
)
from app.modules.assessment.assessment_task.models import AssessmentTask, TaskStatus
from app.modules.assessment.assessment_task.repository import AssessmentTaskRepository
from app.modules.assessment.assessment_task.services.calculate_scores import (
    CalculateScoresService,
)
from app.modules.assessment.assessment_task.services.complete_task import (
    CompleteTaskService,
)
from app.modules.assessment.assessment_task.services.generate_report_pdf import (
    GenerateReportPdfService,
)
from app.modules.assessment.assessment_task.services.start_task import StartTaskService
from app.modules.assessment.assessment_task.services.submit_with_workflow import (
    SubmitWithWorkflowService,
)
from app.modules.assessment.assessment_task.services.update_task_report import (
    UpdateTaskReportService,
)

logger = get_logger(__name__)


class SubmitTaskPipelineService:
    def __init__(
        self,
        task_repo: AssessmentTaskRepository,
        case_repo: AssessmentCaseRepository,
        participant_repo: AssessmentCaseParticipantRepository,
        storage: StorageClient | None = None,
    ):
        self._task_repo = task_repo
        self._case_repo = case_repo
        self._participant_repo = participant_repo
        self._storage = storage

    async def execute(
        self,
        *,
        task: AssessmentTask,
        workflow_type: str,
        assessment_code: str,
        assessment_kor_name: str,
        center_id: str,
        data: dict,
        client_info: dict | None = None,
    ) -> tuple[list, dict]:
        atomics: list = []

        if task.status == TaskStatus.PENDING:
            started_atomic, task = await StartTaskService(self._task_repo).execute(
                task.id
            )
            atomics.append(started_atomic)
            case_atomic = await self._sync_case_status(center_id, task.case_id)
            if case_atomic:
                atomics.append(case_atomic)

        submitted_atomic, task = await SubmitWithWorkflowService(
            self._task_repo
        ).execute(
            task=task,
            workflow_type=workflow_type,
            data=data,
        )
        atomics.append(submitted_atomic)

        pending_report: dict | None = None
        if workflow_type == "self_report":
            if client_info is None:
                client_info = await self._resolve_client_basics(task.case_id)
            try:
                scores, interpretation = await CalculateScoresService(
                    self._task_repo
                ).execute(task, assessment_code, context=client_info)

                report_atomic, task = await UpdateTaskReportService(
                    self._task_repo
                ).execute(task, scores, interpretation)
                atomics.append(report_atomic)

                if self._storage:
                    try:
                        pdf_result = await GenerateReportPdfService(
                            self._task_repo, self._storage
                        ).execute(
                            task_id=task.id,
                            assessment_info={
                                "kor_name": assessment_kor_name,
                                "code": assessment_code,
                            },
                            client_info=client_info,
                        )

                        if not task.report_document_id:
                            pending_report = {
                                "name": f"{assessment_kor_name} 보고서_{task.id[:8]}.pdf",
                                "description": f"검사 보고서 (Task ID: {task.id})",
                                "storage_path": pdf_result["storage_path"],
                                "file_size": pdf_result["file_size"],
                                "checksum": pdf_result["checksum"],
                            }

                    except Exception as pdf_error:
                        logger.error(
                            f"PDF generation failed: {pdf_error}",
                            exc_info=True,
                        )

            except Exception as e:
                logger.error(f"Auto-scoring failed: {e}", exc_info=True)

            if task.status == TaskStatus.SUBMITTED:
                completed_atomic, task = await CompleteTaskService(
                    self._task_repo
                ).execute(task.id)
                atomics.append(completed_atomic)
                case_atomic = await self._sync_case_status(center_id, task.case_id)
                if case_atomic:
                    atomics.append(case_atomic)

        if workflow_type == "external_service" and task.status == TaskStatus.SUBMITTED:
            completed_atomic, task = await CompleteTaskService(self._task_repo).execute(
                task.id
            )
            atomics.append(completed_atomic)
            case_atomic = await self._sync_case_status(center_id, task.case_id)
            if case_atomic:
                atomics.append(case_atomic)

        return atomics, {
            "task_id": task.id,
            "case_id": task.case_id,
            "assessment_id": task.assessment_id,
            "status": task.status,
            "completed_at": task.completed_at,
            "report_payload": task.report_payload,
            "report_document_id": task.report_document_id,
            "pending_report": pending_report,
        }

    async def _sync_case_status(
        self,
        center_id: str,
        case_id: str,
    ) -> AssessmentCaseAtomic | None:
        atomic, _ = await SyncCaseStatusService(
            self._case_repo,
            self._task_repo,
        ).execute(center_id, case_id)
        return atomic

    async def _resolve_client_basics(self, case_id: str) -> dict:
        info: dict = {
            "student_name": "",
            "birth_date": "",
            "gender": "",
            "school_name": "",
            "client_id": None,
        }

        try:
            case = await FindAssessmentCaseService(self._case_repo).execute(case_id)
            if case and case.institution_summary:
                info["school_name"] = case.institution_summary.get("name", "")

            participants = await ListParticipantsByCaseAndTypeService(
                self._participant_repo
            ).execute(case_id, "client")
            if participants:
                info["client_id"] = participants[0].participant_id
        except Exception as e:
            logger.warning(f"Failed to resolve client basics for case {case_id}: {e}")

        return info
