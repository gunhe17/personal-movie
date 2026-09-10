from dataclasses import dataclass

from app.modules.assessment.assessment_task.models import TaskStatus
from app.core.config import settings
from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..assessment_task.repository import AssessmentTaskRepository
from ..assessment_task.services import ListTasksByCaseService
from ..assessment.repository import AssessmentRepository
from ..assessment.services import GetAssessmentsByIdsService
from ..send_result.events import SendResultAtomic
from ..send_result.models import AssessmentSendResult
from ..send_result.repository import AssessmentSendResultRepository
from ..send_result.schemas import (
    SendResultCreate,
    PendingAssessment,
)
from ..send_result.services import (
    CreateSendResultService,
    GetSendResultService,
    ListSendResultsService,
    ListSendResultsByCenterService,
    VerifySendResultService,
)


@dataclass
class CompletedReportRef:
    assessment_name: str
    report_document_id: str


@dataclass
class VerifiedReports:
    center_id: str
    completed: list[CompletedReportRef]
    pending: list[PendingAssessment]


class SendResultFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def _validate_completed_reports(self, case_id: str) -> None:
        task_repo = self._uow.repo(AssessmentTaskRepository)
        service = ListTasksByCaseService(task_repo)
        tasks = await service.execute(case_id)

        has_report = any(
            t.status == TaskStatus.COMPLETED and t.report_document_id for t in tasks
        )
        if not has_report:
            raise InvalidOperationException(
                "보고서가 준비된 검사가 없습니다. 검사 완료 후 보고서를 생성해주세요."
            )

    async def create_send_result(
        self,
        center_id: str,
        case_id: str,
        data: SendResultCreate,
    ) -> tuple[SendResultAtomic, AssessmentSendResult]:
        await self._validate_completed_reports(case_id)

        repo = self._uow.repo(AssessmentSendResultRepository)
        service = CreateSendResultService(repo)
        return await service.execute(
            center_id=center_id,
            case_id=case_id,
            recipients=[r.model_dump() for r in data.recipients],
            channel=data.channel.value,
            expires_at=data.expires_at,
        )

    async def get_send_result(
        self,
        center_id: str,
        case_id: str,
        send_result_id: str,
        validate_active: bool = False,
    ) -> AssessmentSendResult:
        repo = self._uow.repo(AssessmentSendResultRepository)
        service = GetSendResultService(repo)
        return await service.execute(
            center_id, case_id, send_result_id, validate_active
        )

    async def list_send_results(
        self,
        center_id: str,
        case_id: str,
    ) -> list[AssessmentSendResult]:
        repo = self._uow.repo(AssessmentSendResultRepository)
        service = ListSendResultsService(repo)
        return await service.execute(center_id, case_id)

    async def verify_and_collect_reports(
        self,
        send_result_id: str,
        verification_code: str,
    ) -> VerifiedReports:
        send_result_repo = self._uow.repo(AssessmentSendResultRepository)
        verify_service = VerifySendResultService(send_result_repo)
        send_result = await verify_service.execute(send_result_id, verification_code)

        task_repo = self._uow.repo(AssessmentTaskRepository)
        list_tasks_service = ListTasksByCaseService(task_repo)
        tasks = await list_tasks_service.execute(send_result.case_id)

        completed_tasks = [
            t
            for t in tasks
            if t.status == TaskStatus.COMPLETED and t.report_document_id
        ]
        pending_tasks = [
            t
            for t in tasks
            if not (t.status == TaskStatus.COMPLETED and t.report_document_id)
            and t.status not in ("cancelled", "refused")
        ]

        all_assessment_ids = list(
            set(t.assessment_id for t in completed_tasks + pending_tasks)
        )
        assessment_repo = self._uow.repo(AssessmentRepository)
        assessment_service = GetAssessmentsByIdsService(assessment_repo)
        assessments = await assessment_service.execute(all_assessment_ids)
        name_map = {a.id: a.kor_name for a in assessments}

        completed = [
            CompletedReportRef(
                assessment_name=name_map.get(t.assessment_id, "검사 보고서"),
                report_document_id=t.report_document_id,
            )
            for t in completed_tasks
        ]
        pending = [
            PendingAssessment(
                assessment_name=name_map.get(t.assessment_id, "검사"),
                status=t.status,
            )
            for t in pending_tasks
        ]

        return VerifiedReports(
            center_id=send_result.center_id,
            completed=completed,
            pending=pending,
        )

    async def list_by_center(self, center_id: str, page: int, size: int):
        return await ListSendResultsByCenterService(
            self._uow.repo(AssessmentSendResultRepository)
        ).execute(center_id, page=page, size=size)

    @staticmethod
    def build_url(send_result_id: str) -> str:
        base_url = settings.ASSESSMENT_RESULT_BASE_URL
        if not base_url:
            base_url = f"{settings.FRONTEND_URL}/verify-result"
        return f"{base_url}?send_result_id={send_result_id}"
