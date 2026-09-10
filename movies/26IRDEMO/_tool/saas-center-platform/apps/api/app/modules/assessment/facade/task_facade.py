from app.modules.assessment.assessment_case.models import CaseStatus
from app.modules.assessment.assessment_task.models import TaskStatus
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import (
    EntityNotFoundException,
    InvalidOperationException,
    PermissionDeniedException,
)
from app.core.logger import get_logger
from app.infrastructure.storage import StorageClient
from ..assessment_task.repository import AssessmentTaskRepository
from ..assessment_task.models import AssessmentTask
from ..assessment_task.events import AssessmentTaskAtomic
from ..assessment_task.services import (
    CancelTaskService,
    CompleteTaskService,
    CreateTasksForCaseService,
    DeleteTaskService,
    DeleteTasksByCaseService,
    GetTaskByCaseAssessmentService,
    GetTaskByIdService,
    GetTaskProgressBulkService,
    ListTasksByCaseService,
    MarkReportsVisibleToGuardianService,
    ListTasksByFiltersService,
    ListTasksByIdsService,
    RefuseTaskService,
    RevertTaskService,
    RevertCancelTaskService,
    RevertCancelTasksByCaseService,
    StartTaskService,
    UpdateTaskService,
    UpdateTaskOpinionService,
    SubmitTaskPipelineService,
)
from ..assessment.repository import AssessmentRepository
from ..assessment.services import GetAssessmentService
from ..assessment_case.events import AssessmentCaseAtomic
from ..assessment_case.repository import AssessmentCaseRepository
from ..assessment_case.events import AssessmentCaseAtomic
from ..assessment_case.services import (
    FindAssessmentCaseService,
    SyncCaseStatusService,
    VerifyCaseAccessService,
)
from ..assessment_case_participant.repository import (
    AssessmentCaseParticipantRepository,
)

logger = get_logger(__name__)


class AssessmentTaskFacade:
    def __init__(self, uow: UnitOfWork, storage: StorageClient | None = None):
        self._uow = uow
        self._storage = storage

    async def _resolve_client_basics(self, case_id: str) -> dict:
        # 이름·생년·성별은 cross-module(client)이라 비움 — Application Handler가 ClientFacade로 채운다
        from ..assessment_case_participant.repository import (
            AssessmentCaseParticipantRepository,
        )
        from ..assessment_case_participant.services import (
            ListParticipantsByCaseAndTypeService,
        )

        info: dict = {
            "student_name": "",
            "birth_date": "",
            "gender": "",
            "school_name": "",
            "client_id": None,
        }

        try:
            case_repo = self._uow.repo(AssessmentCaseRepository)
            case = await FindAssessmentCaseService(case_repo).execute(case_id)
            if case and case.institution_summary:
                info["school_name"] = case.institution_summary.get("name", "")

            participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)
            participants = await ListParticipantsByCaseAndTypeService(
                participant_repo
            ).execute(case_id, "client")
            if participants:
                info["client_id"] = participants[0].participant_id
        except Exception as e:
            logger.warning(f"Failed to resolve client basics for case {case_id}: {e}")

        return info

    async def list_linkable_tasks(self, center_id: str) -> list[dict]:
        # 온라인 검사는 녹음 대상이 아니므로 onsite만
        from ..assessment_case_participant.repository import (
            AssessmentCaseParticipantRepository,
        )
        from ..assessment_case_participant.services import (
            ListParticipantsByCaseAndTypeService,
        )
        from ..assessment_case.services import ListCasesByIdsService
        from ..assessment_session.repository import AssessmentSessionRepository
        from ..assessment_session.services import ListSessionsByCaseIdsService

        task_repo = self._uow.repo(AssessmentTaskRepository)
        tasks = await ListTasksByFiltersService(task_repo).execute(
            center_id=center_id,
            execution_method="onsite",
            status_list=["pending", "in_progress", "submitted"],
            case_status=CaseStatus.PROCESSING,
        )
        if not tasks:
            return []

        assessment_repo = self._uow.repo(AssessmentRepository)
        get_assessment = GetAssessmentService(assessment_repo)
        assessment_cache: dict[str, object] = {}

        async def _assessment(aid: str):
            if aid not in assessment_cache:
                try:
                    assessment_cache[aid] = await get_assessment.execute(aid)
                except Exception:
                    assessment_cache[aid] = None
            return assessment_cache[aid]

        case_repo = self._uow.repo(AssessmentCaseRepository)
        case_ids = list({t.case_id for t in tasks})
        cases = await ListCasesByIdsService(case_repo).execute(case_ids)
        case_by_id = {c.id: c for c in cases}

        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)
        list_participants_service = ListParticipantsByCaseAndTypeService(
            participant_repo
        )
        case_client_id: dict[str, str] = {}
        for cid in case_ids:
            parts = await list_participants_service.execute(cid, "client")
            if parts:
                case_client_id[cid] = parts[0].participant_id

        sessions = await ListSessionsByCaseIdsService(
            self._uow.repo(AssessmentSessionRepository)
        ).execute(case_ids)
        case_schedule_ids: dict[str, list[str]] = {}
        for s in sessions:
            if s.schedule_id:
                case_schedule_ids.setdefault(s.case_id, []).append(s.schedule_id)

        result: list[dict] = []
        for t in tasks:
            assessment = await _assessment(t.assessment_id)
            case = case_by_id.get(t.case_id)
            result.append(
                {
                    "task_id": t.id,
                    "case_id": t.case_id,
                    "case_code": case.case_code if case else None,
                    "client_id": case_client_id.get(t.case_id),
                    "schedule_ids": case_schedule_ids.get(t.case_id, []),
                    "assessment_code": getattr(assessment, "code", None),
                    "assessment_kor_name": getattr(assessment, "kor_name", None),
                    "execution_method": t.execution_method,
                    "task_status": t.status,
                    "created_at": t.created_at,
                }
            )
        return result

    async def get_assessment_task_summaries_by_ids(
        self, task_ids: list[str]
    ) -> dict[str, str]:
        if not task_ids:
            return {}

        task_repo = self._uow.repo(AssessmentTaskRepository)
        tasks = await ListTasksByIdsService(task_repo).execute(task_ids)
        if not tasks:
            return {}

        from ..assessment.services import GetAssessmentsByIdsService
        from ..assessment_case.services import ListCasesByIdsService

        assessments = await GetAssessmentsByIdsService(
            self._uow.repo(AssessmentRepository)
        ).execute(list({t.assessment_id for t in tasks if t.assessment_id}))
        kor_name_by_id = {a.id: a.kor_name for a in assessments}

        cases = await ListCasesByIdsService(
            self._uow.repo(AssessmentCaseRepository)
        ).execute(list({t.case_id for t in tasks if t.case_id}))
        case_code_by_id = {c.id: c.case_code for c in cases}

        summaries: dict[str, str] = {}
        for t in tasks:
            parts = [
                p
                for p in (
                    case_code_by_id.get(t.case_id),
                    kor_name_by_id.get(t.assessment_id),
                )
                if p
            ]
            if parts:
                summaries[t.id] = " · ".join(parts)
        return summaries

    async def get_tasks_display_info_by_ids(
        self, task_ids: list[str]
    ) -> dict[str, dict]:
        # field_note → assessment 진입점: field_note가 AssessmentTask를 직접 보지 않게 이 Facade만 호출(§3-4-2)
        from ..assessment_case_participant.repository import (
            AssessmentCaseParticipantRepository,
        )
        from ..assessment_case_participant.services import (
            ListParticipantsByCaseAndTypeService,
        )
        from ..assessment_case.services import ListCasesByIdsService

        if not task_ids:
            return {}

        task_repo = self._uow.repo(AssessmentTaskRepository)
        tasks = await ListTasksByIdsService(task_repo).execute(task_ids)
        if not tasks:
            return {}

        assessment_repo = self._uow.repo(AssessmentRepository)
        get_assessment = GetAssessmentService(assessment_repo)
        assessment_cache: dict[str, object] = {}

        async def _assessment(aid: str):
            if aid not in assessment_cache:
                try:
                    assessment_cache[aid] = await get_assessment.execute(aid)
                except Exception:
                    assessment_cache[aid] = None
            return assessment_cache[aid]

        case_repo = self._uow.repo(AssessmentCaseRepository)
        case_ids = list({t.case_id for t in tasks})
        cases = await ListCasesByIdsService(case_repo).execute(case_ids)
        case_by_id = {c.id: c for c in cases}

        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)
        list_participants_service = ListParticipantsByCaseAndTypeService(
            participant_repo
        )
        case_client_id: dict[str, str] = {}
        for cid in case_ids:
            parts = await list_participants_service.execute(cid, "client")
            if parts:
                case_client_id[cid] = parts[0].participant_id

        # task.session_id가 비어있을 수 있어 schedule 연결은 case 경유.
        # room 해소(schedule→room)는 크로스모듈 — 호출자(application handler)가 schedule_ids로 조립.
        from ..assessment_session.repository import AssessmentSessionRepository
        from ..assessment_session.services import ListSessionsByCaseIdsService

        sessions = await ListSessionsByCaseIdsService(
            self._uow.repo(AssessmentSessionRepository)
        ).execute(case_ids)
        case_schedule_ids: dict[str, list[str]] = {}
        for s in sessions:
            if s.schedule_id:
                case_schedule_ids.setdefault(s.case_id, []).append(s.schedule_id)

        result: dict[str, dict] = {}
        for t in tasks:
            assessment = await _assessment(t.assessment_id)
            case = case_by_id.get(t.case_id)
            result[t.id] = {
                "task_id": t.id,
                "case_id": t.case_id,
                "case_code": case.case_code if case else None,
                "client_id": case_client_id.get(t.case_id),
                "assessment_code": getattr(assessment, "code", None),
                "assessment_kor_name": getattr(assessment, "kor_name", None),
                "schedule_ids": case_schedule_ids.get(t.case_id, []),
                "task_status": t.status,
                "execution_method": t.execution_method,
            }
        return result

    async def _sync_case_status(
        self, center_id: str, case_id: str
    ) -> AssessmentCaseAtomic | None:
        service = SyncCaseStatusService(
            self._uow.repo(AssessmentCaseRepository),
            self._uow.repo(AssessmentTaskRepository),
        )
        atomic, _ = await service.execute(center_id, case_id)
        return atomic

    async def verify_task_writable(
        self,
        center_id: str,
        task_id: str,
        member_id: str | None,
    ) -> None:
        # 검사 수행 정보의 쓰기 권한은 소속 케이스의 주담당에게만 — 참여 검사자는 열람만
        task = await self.get_task(task_id, center_id)

        case_repo = self._uow.repo(AssessmentCaseRepository)
        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)

        await VerifyCaseAccessService(case_repo, participant_repo).execute(
            center_id,
            task.case_id,
            member_id=member_id,
            writable=True,
        )

    async def get_task(self, task_id: str, center_id: str) -> AssessmentTask:
        # get_task_with_assessment와 달리 pending→in_progress 자동 전환 없음(부작용 없는 조회)
        repo = self._uow.repo(AssessmentTaskRepository)
        task = await GetTaskByIdService(repo).execute(task_id)
        if task.center_id != center_id:
            raise EntityNotFoundException(
                f"검사 수행 정보를 찾을 수 없습니다 (task_id={task_id})"
            )
        return task

    async def get_tasks_by_case_id(self, case_id: str) -> list[AssessmentTask]:
        repo = self._uow.repo(AssessmentTaskRepository)
        service = ListTasksByCaseService(repo)
        return await service.execute(case_id)

    async def cancel_tasks(
        self,
        case_id: str,
        assessment_ids: list[str],
        reason: str = "Case 수정으로 인한 자동 취소",
    ) -> tuple[list[AssessmentTaskAtomic], list[dict]]:
        repo = self._uow.repo(AssessmentTaskRepository)

        list_service = ListTasksByCaseService(repo)
        all_tasks = await list_service.execute(case_id)

        assessment_id_set = set(assessment_ids)
        target_tasks = [t for t in all_tasks if t.assessment_id in assessment_id_set]

        cancel_service = CancelTaskService(repo)
        atomics = []
        cancelled_tasks = []

        for task in target_tasks:
            try:
                previous_status = task.status
                atomic, _ = await cancel_service.execute(task.id, reason)
                atomics.append(atomic)
                cancelled_tasks.append(
                    {
                        "task_id": task.id,
                        "assessment_id": task.assessment_id,
                        "previous_status": previous_status,
                    }
                )
            except (EntityNotFoundException, InvalidOperationException):
                # task가 없거나 취소 불가능한 상태면 스킵
                continue

        return atomics, cancelled_tasks

    async def create_tasks_for_case(
        self,
        center_id: str,
        case_id: str,
        assessment_ids: list[str],
        execution_method: str,
    ) -> tuple[list[AssessmentTaskAtomic], list[dict]]:
        repo = self._uow.repo(AssessmentTaskRepository)
        service = CreateTasksForCaseService(repo)

        assessment_execution_methods = {aid: execution_method for aid in assessment_ids}
        atomics, _tasks = await service.execute(
            center_id, case_id, assessment_execution_methods
        )

        return atomics, [{"assessment_id": aid} for aid in assessment_ids]

    async def get_task_with_assessment(
        self,
        task_id: str,
    ) -> dict:
        # 순수 조회 — pending→in_progress 전이는 start_task_with_assessment가 소유.
        task, assessment = await self._load_task_and_assessment(task_id)
        return self._task_assessment_dict(task, assessment)

    async def start_task_with_assessment(
        self,
        task_id: str,
    ) -> tuple[list, dict]:
        task, assessment = await self._load_task_and_assessment(task_id)

        atomics = []
        if task.status == TaskStatus.PENDING:
            start_service = StartTaskService(self._uow.repo(AssessmentTaskRepository))
            started_atomic, task = await start_service.execute(task_id)
            atomics.append(started_atomic)
            case_atomic = await self._sync_case_status(task.center_id, task.case_id)
            if case_atomic is not None:
                atomics.append(case_atomic)

        return atomics, self._task_assessment_dict(task, assessment)

    async def _load_task_and_assessment(self, task_id: str):
        task = await GetTaskByIdService(
            self._uow.repo(AssessmentTaskRepository)
        ).execute(task_id)
        assessment = await GetAssessmentService(
            self._uow.repo(AssessmentRepository)
        ).execute(task.assessment_id)
        return task, assessment

    def _task_assessment_dict(self, task, assessment) -> dict:
        return {
            "task": task,
            "assessment": {
                "code": assessment.code,
                "kor_name": assessment.kor_name,
                "workflow_type": assessment.workflow_type,
                "definition": assessment.definition,
                "external_url": assessment.external_url,
            },
        }

    async def submit_task(
        self,
        task_id: str,
        center_id: str,
        data: dict,
        client_info: dict | None = None,
    ) -> tuple[list, dict]:
        task_repo = self._uow.repo(AssessmentTaskRepository)
        task = await GetTaskByIdService(task_repo).execute(task_id)

        if task.center_id != center_id:
            raise PermissionDeniedException("해당 센터의 검사가 아닙니다")

        assessment_repo = self._uow.repo(AssessmentRepository)
        assessment = await GetAssessmentService(assessment_repo).execute(
            task.assessment_id
        )

        from ..assessment_case_participant.repository import (
            AssessmentCaseParticipantRepository,
        )

        pipeline = SubmitTaskPipelineService(
            task_repo,
            self._uow.repo(AssessmentCaseRepository),
            self._uow.repo(AssessmentCaseParticipantRepository),
            self._storage,
        )
        return await pipeline.execute(
            task=task,
            workflow_type=assessment.workflow_type,
            assessment_code=assessment.code,
            assessment_kor_name=assessment.kor_name,
            center_id=center_id,
            data=data,
            client_info=client_info,
        )

    async def get_report_client_info_by_task(self, task_id: str) -> dict:
        task_repo = self._uow.repo(AssessmentTaskRepository)
        task = await GetTaskByIdService(task_repo).execute(task_id)
        return await self._resolve_client_basics(task.case_id)

    async def attach_report_document(
        self,
        task_id: str,
        document_id: str,
    ) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        task_repo = self._uow.repo(AssessmentTaskRepository)
        task = await GetTaskByIdService(task_repo).execute(task_id)
        update_task_service = UpdateTaskService(task_repo)
        return await update_task_service.execute(task, report_document_id=document_id)

    async def list_tasks(
        self,
        case_id: str,
        execution_method: str | None = None,
    ) -> list[dict]:
        task_repo = self._uow.repo(AssessmentTaskRepository)
        list_tasks_service = ListTasksByCaseService(task_repo)
        tasks = await list_tasks_service.execute(case_id, execution_method)

        if not tasks:
            return []

        assessment_ids = list(set(t.assessment_id for t in tasks))
        assessment_repo = self._uow.repo(AssessmentRepository)
        get_assessment_service = GetAssessmentService(assessment_repo)

        assessment_map = {}
        for assessment_id in assessment_ids:
            assessment = await get_assessment_service.execute(assessment_id)
            assessment_map[assessment_id] = assessment

        result = []
        for task in tasks:
            assessment = assessment_map.get(task.assessment_id)
            result.append(
                {
                    "task": task,
                    "assessment": assessment,
                }
            )

        return result

    async def refuse_task(
        self,
        task_id: str,
        center_id: str,
        reason: str,
    ) -> tuple[list, AssessmentTask]:
        repo = self._uow.repo(AssessmentTaskRepository)

        get_task_service = GetTaskByIdService(repo)
        task = await get_task_service.execute(task_id)

        if task.center_id != center_id:
            raise PermissionDeniedException("해당 센터의 검사가 아닙니다")

        service = RefuseTaskService(repo)
        atomic, task = await service.execute(task_id, reason)

        atomics = [atomic]
        case_atomic = await self._sync_case_status(center_id, task.case_id)
        if case_atomic:
            atomics.append(case_atomic)

        return atomics, task

    async def cancel_task(
        self,
        task_id: str,
        center_id: str,
        reason: str,
    ) -> tuple[list, AssessmentTask]:
        repo = self._uow.repo(AssessmentTaskRepository)

        get_task_service = GetTaskByIdService(repo)
        task = await get_task_service.execute(task_id)

        if task.center_id != center_id:
            raise PermissionDeniedException("해당 센터의 검사가 아닙니다")

        service = CancelTaskService(repo)
        atomic, task = await service.execute(task_id, reason)

        atomics = [atomic]
        case_atomic = await self._sync_case_status(center_id, task.case_id)
        if case_atomic:
            atomics.append(case_atomic)

        return atomics, task

    async def delete_task(
        self,
        task_id: str,
        center_id: str,
    ) -> tuple[list, AssessmentTask, int]:
        repo = self._uow.repo(AssessmentTaskRepository)

        get_task_service = GetTaskByIdService(repo)
        task = await get_task_service.execute(task_id)

        if task.center_id != center_id:
            raise PermissionDeniedException("해당 센터의 검사가 아닙니다")

        case_id = task.case_id

        service = DeleteTaskService(repo)
        atomic, task = await service.execute(task_id)

        remaining_tasks = await ListTasksByCaseService(repo).execute(case_id)
        remaining_count = len(remaining_tasks)

        # 남은 수가 0이면 Case 동기화 생략 — 호출자(Handler)가 Case 삭제로 처리
        atomics = [atomic]
        if remaining_count > 0:
            case_atomic = await self._sync_case_status(center_id, case_id)
            if case_atomic:
                atomics.append(case_atomic)

        return atomics, task, remaining_count

    async def revert_cancel_task(
        self,
        task_id: str,
        center_id: str,
    ) -> tuple[list, AssessmentTask]:
        repo = self._uow.repo(AssessmentTaskRepository)

        get_task_service = GetTaskByIdService(repo)
        task = await get_task_service.execute(task_id)

        if task.center_id != center_id:
            raise PermissionDeniedException("해당 센터의 검사가 아닙니다")

        service = RevertCancelTaskService(repo)
        atomic, task = await service.execute(task_id)

        atomics = [atomic]
        case_atomic = await self._sync_case_status(center_id, task.case_id)
        if case_atomic:
            atomics.append(case_atomic)

        return atomics, task

    async def update_task_opinion(
        self,
        center_id: str,
        task_id: str,
        opinion: str | None,
    ) -> tuple[AssessmentTaskAtomic, AssessmentTask]:
        repo = self._uow.repo(AssessmentTaskRepository)
        service = UpdateTaskOpinionService(repo)
        return await service.execute(
            task_id=task_id, center_id=center_id, opinion=opinion
        )

    async def complete_task(
        self,
        center_id: str,
        case_id: str,
        assessment_id: str,
    ) -> tuple[list, AssessmentTask]:
        repo = self._uow.repo(AssessmentTaskRepository)

        task = await GetTaskByCaseAssessmentService(repo).execute(
            case_id=case_id, assessment_id=assessment_id
        )

        if task.center_id != center_id:
            raise PermissionDeniedException("해당 센터의 검사가 아닙니다")

        service = CompleteTaskService(repo)
        atomic, task = await service.execute(task.id)

        atomics = [atomic]
        case_atomic = await self._sync_case_status(center_id, task.case_id)
        if case_atomic:
            atomics.append(case_atomic)

        return atomics, task

    async def revert_task(
        self,
        center_id: str,
        case_id: str,
        assessment_id: str,
    ) -> tuple[list, AssessmentTask]:
        repo = self._uow.repo(AssessmentTaskRepository)

        task = await GetTaskByCaseAssessmentService(repo).execute(
            case_id=case_id, assessment_id=assessment_id
        )

        if task.center_id != center_id:
            raise PermissionDeniedException("해당 센터의 검사가 아닙니다")

        service = RevertTaskService(repo)
        atomic, task = await service.execute(task.id)

        atomics = [atomic]
        case_atomic = await self._sync_case_status(center_id, task.case_id)
        if case_atomic:
            atomics.append(case_atomic)

        return atomics, task

    async def mark_reports_visible_to_guardian(
        self, case_id: str
    ) -> list[AssessmentTask]:
        repo = self._uow.repo(AssessmentTaskRepository)
        service = MarkReportsVisibleToGuardianService(repo)
        return await service.execute(case_id=case_id)

    async def get_task_progress_for_cases(self, case_ids: list[str]) -> dict:
        repo = self._uow.repo(AssessmentTaskRepository)
        service = GetTaskProgressBulkService(repo)
        return await service.execute(case_ids)

    async def delete_tasks_by_case(
        self,
        case_id: str,
    ) -> tuple[list[AssessmentTaskAtomic], int]:
        repo = self._uow.repo(AssessmentTaskRepository)
        return await DeleteTasksByCaseService(repo).execute(case_id)

    async def revert_cancel_tasks_by_case(
        self,
        case_id: str,
    ) -> tuple[list[AssessmentTaskAtomic], int]:
        repo = self._uow.repo(AssessmentTaskRepository)
        return await RevertCancelTasksByCaseService(repo).execute(case_id)
