from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.new_repository import Page
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .schemas import (
    SetSummarySnapshot,
    CaseCreationRequest,
    CaseCreationResult,
    SessionCreationResult,
    BulkCaseCreationRequest,
    BulkCaseCreationResult,
    BulkSessionCreationRequest,
    BulkSessionCreationResult,
    UnsharedCompletedCase,
)
from ..assessment.schemas import AssessmentSummary

from ..assessment_case.events import AssessmentCaseAtomic
from ..assessment.repository import AssessmentRepository
from ..assessment.services import (
    GetAssessmentsService,
    GetAssessmentsByIdsService,
)
from ..center_assessment.repository import CenterAssessmentRepository
from ..center_assessment.services import ValidateCenterAssessmentsService
from ..assessment_case.repository import AssessmentCaseRepository
from ..assessment_case.services import (
    CreateAssessmentCaseService,
    GetAssessmentCaseService,
    UpdateCaseCounselorService,
    UpdateCaseSetSummaryService,
    UpdateCaseAssessmentSummaryService,
    UpdateCaseInstitutionSummaryService,
    ListAssessmentCasesService,
    ListCasesByIdsService,
    ListCaseIdsByCounselorService,
    ListCompletedCasesByIdsService,
    VerifyCaseAccessService,
)
from ..assessment_case.models import AssessmentCase
from ..assessment_case.schemas import (
    AssessmentCaseUpdate,
    UpdateValidationResult,
)
from ..assessment_case_participant.repository import AssessmentCaseParticipantRepository
from ..assessment_case_participant.services import (
    AddCaseParticipantsBatchService,
    ListCaseParticipantsService,
    AnalyzeParticipantChangesService,
    AggregateClientIdsByCaseIdsService,
    ListParticipantsByParticipantIdsService,
    ListCaseIdsByAssistantService,
    ListCaseIdsByClientService,
    ListAllClientIdsByCaseIdsService,
    RemoveParticipantsByCaseService,
)
from ..send_result.repository import AssessmentSendResultRepository
from ..send_result.services import ListActiveCaseIdsService
from ..assessment_task.repository import AssessmentTaskRepository
from ..assessment_task.services import (
    CreateTasksForCaseService,
    ListTasksByCaseService,
    AnalyzeAssessmentChangesService,
)
from ..assessment_set.repository import AssessmentSetRepository
from ..assessment_set.services import GetAssessmentSetService
from ..assessment_session.repository import AssessmentSessionRepository
from ..assessment_session.services import (
    CreateSessionService,
    ListSessionsByCaseIdsService,
    AnalyzeScheduleChangesService,
    AggregateActiveCaseMapByScheduleIdsService,
)
from ..assessment_session_participant.repository import (
    AssessmentSessionParticipantRepository,
)
from ..assessment_session_participant.services import (
    InitializeSessionParticipantsService,
)


class AssessmentCaseFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def list_client_ids_by_counselor(
        self,
        center_id: str,
        counselor_id: str,
    ) -> set[str]:
        # 담당 범위는 의도적으로 넓다 — 주/보조 검사자, 상태·참여 활성 여부 무관(과거 포함)
        case_repo = self._uow.repo(AssessmentCaseRepository)
        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)

        primary_ids = await ListCaseIdsByCounselorService(case_repo).execute(
            center_id=center_id,
            counselor_id=counselor_id,
        )
        secondary_ids = await ListCaseIdsByAssistantService(participant_repo).execute(
            center_id=center_id,
            member_id=counselor_id,
        )

        case_ids = list({*primary_ids, *secondary_ids})
        if not case_ids:
            return set()

        client_ids = await ListAllClientIdsByCaseIdsService(participant_repo).execute(
            case_ids
        )
        return set(client_ids)

    async def aggregate_cases_by_schedule_ids(
        self,
        schedule_ids: list[str],
    ) -> dict[str, AssessmentCase]:
        if not schedule_ids:
            return {}

        session_repo = self._uow.repo(AssessmentSessionRepository)
        case_repo = self._uow.repo(AssessmentCaseRepository)

        find_map_service = AggregateActiveCaseMapByScheduleIdsService(session_repo)
        schedule_to_case = await find_map_service.execute(schedule_ids)
        if not schedule_to_case:
            return {}

        case_ids = list(set(schedule_to_case.values()))
        list_cases_service = ListCasesByIdsService(case_repo)
        cases = await list_cases_service.execute(case_ids)
        case_by_id = {c.id: c for c in cases}

        return {
            sid: case_by_id[cid]
            for sid, cid in schedule_to_case.items()
            if cid in case_by_id
        }

    async def list_accessible_case_ids(
        self,
        center_id: str,
        member_id: str,
    ) -> list[str]:
        # 열람 범위 = 주담당(case.counselor_id) + 참여 검사자. 쓰기 범위(주담당 전용)와 다르다.
        case_repo = self._uow.repo(AssessmentCaseRepository)
        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)

        primary_ids = await ListCaseIdsByCounselorService(case_repo).execute(
            center_id=center_id,
            counselor_id=member_id,
        )
        participating_ids = await ListCaseIdsByAssistantService(
            participant_repo
        ).execute(
            center_id=center_id,
            member_id=member_id,
        )

        return list({*primary_ids, *participating_ids})

    async def verify_case_readable(
        self,
        center_id: str,
        case_id: str,
        member_id: str | None,
    ) -> None:
        case_repo = self._uow.repo(AssessmentCaseRepository)
        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)

        await VerifyCaseAccessService(case_repo, participant_repo).execute(
            center_id,
            case_id,
            member_id=member_id,
        )

    async def verify_case_writable(
        self,
        center_id: str,
        case_id: str,
        member_id: str | None,
    ) -> None:
        case_repo = self._uow.repo(AssessmentCaseRepository)
        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)

        await VerifyCaseAccessService(case_repo, participant_repo).execute(
            center_id,
            case_id,
            member_id=member_id,
            writable=True,
        )

    async def list_case_ids_by_counselor(
        self,
        center_id: str,
        counselor_id: str,
    ) -> list[str]:
        case_repo = self._uow.repo(AssessmentCaseRepository)
        return await ListCaseIdsByCounselorService(case_repo).execute(
            center_id=center_id,
            counselor_id=counselor_id,
        )

    async def aggregate_client_ids_by_case_ids(
        self,
        case_ids: list[str],
    ) -> dict[str, list[str]]:
        if not case_ids:
            return {}
        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)
        service = AggregateClientIdsByCaseIdsService(participant_repo)
        return await service.execute(case_ids)

    async def aggregate_unshared_completed_per_client(
        self,
        center_id: str,
        client_ids: list[str],
    ) -> dict[str, UnsharedCompletedCase]:
        if not client_ids:
            return {}

        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)
        participants = await ListParticipantsByParticipantIdsService(
            participant_repo
        ).execute(
            participant_ids=client_ids,
            center_id=center_id,
            participant_type="client",
            active_only=True,
        )
        if not participants:
            return {}

        case_to_client: dict[str, str] = {
            p.case_id: p.participant_id for p in participants
        }
        case_ids = list(case_to_client.keys())

        case_repo = self._uow.repo(AssessmentCaseRepository)
        completed_cases = await ListCompletedCasesByIdsService(case_repo).execute(
            case_ids
        )
        if not completed_cases:
            return {}

        completed_ids = [c.id for c in completed_cases]

        send_result_repo = self._uow.repo(AssessmentSendResultRepository)
        active_set = await ListActiveCaseIdsService(send_result_repo).execute(
            completed_ids
        )

        result: dict[str, UnsharedCompletedCase] = {}
        for case in completed_cases:
            if case.id in active_set:
                continue
            client_id = case_to_client.get(case.id)
            if not client_id or case.completed_at is None:
                continue
            existing = result.get(client_id)
            if existing is None or case.completed_at > existing.completed_at:
                result[client_id] = UnsharedCompletedCase(
                    case_id=case.id,
                    completed_at=case.completed_at,
                )
        return result

    async def validate_assessments(
        self,
        center_id: str,
        assessment_ids: list[str],
    ) -> None:
        repo = self._uow.repo(CenterAssessmentRepository)
        service = ValidateCenterAssessmentsService(repo)
        await service.execute(center_id, assessment_ids)

    async def get_assessment_summaries(
        self,
        assessment_ids: list[str],
    ) -> list[AssessmentSummary]:
        repo = self._uow.repo(AssessmentRepository)
        service = GetAssessmentsService(repo)
        assessments = await service.execute(assessment_ids)
        return [AssessmentSummary.model_validate(a) for a in assessments]

    async def get_set_summary(
        self,
        center_id: str,
        set_id: str,
    ) -> SetSummarySnapshot:
        repo = self._uow.repo(AssessmentSetRepository)
        service = GetAssessmentSetService(repo)
        assessment_set = await service.execute(center_id, set_id)

        snapshot_at = utc_now()
        return SetSummarySnapshot(
            set_id=assessment_set.id,
            name=assessment_set.name,
            source_updated_at=assessment_set.updated_at,
            snapshot_at=snapshot_at,
        )

    async def create_case_with_participants_and_tasks(
        self,
        center_id: str,
        counselor_id: str,
        client_ids: list[str],
        assessment_ids: list[str],
        assessment_summary: list[dict],
        assistant_ids: list[str] | None = None,
        set_summary: dict | None = None,
        institution_summary: dict | None = None,
        tags: list[str] | None = None,
        is_final_report_required: bool = False,
    ) -> tuple[list, CaseCreationResult]:
        summary_dtos = [AssessmentSummary(**s) for s in assessment_summary]
        set_dto = SetSummarySnapshot(**set_summary) if set_summary else None
        request = CaseCreationRequest(
            center_id=center_id,
            counselor_id=counselor_id,
            client_ids=client_ids,
            assessment_ids=assessment_ids,
            assessment_summary=summary_dtos,
            assistant_ids=assistant_ids or [],
            set_summary=set_dto,
            institution_summary=institution_summary,
            tags=tags or [],
            is_final_report_required=is_final_report_required,
        )

        case_repo = self._uow.repo(AssessmentCaseRepository)
        case_service = CreateAssessmentCaseService(case_repo)

        assessment_summary_dicts = [
            s.model_dump(mode="json") for s in request.assessment_summary
        ]
        set_summary_dict = (
            request.set_summary.model_dump(mode="json") if request.set_summary else None
        )

        case_atomic, case = await case_service.execute(
            center_id=request.center_id,
            counselor_id=request.counselor_id,
            assessment_summary=assessment_summary_dicts,
            tags=request.tags,
            is_final_report_required=request.is_final_report_required,
            set_summary=set_summary_dict,
            institution_summary=request.institution_summary,
        )

        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)
        participant_service = AddCaseParticipantsBatchService(participant_repo)

        # counselor_id는 Case에만 저장, assistant_ids만 Participant로 관리
        participant_atomics, _participants = await participant_service.execute(
            center_id=request.center_id,
            case_id=case.id,
            client_ids=request.client_ids,
            assistant_ids=request.assistant_ids,
        )

        assessment_repo = self._uow.repo(AssessmentRepository)
        assessments = await GetAssessmentsByIdsService(assessment_repo).execute(
            request.assessment_ids
        )

        assessment_execution_methods = {
            assessment.id: "online" if assessment.supports_online else "onsite"
            for assessment in assessments
        }

        task_repo = self._uow.repo(AssessmentTaskRepository)
        task_service = CreateTasksForCaseService(task_repo)

        task_atomics, _tasks = await task_service.execute(
            center_id=request.center_id,
            case_id=case.id,
            assessment_execution_methods=assessment_execution_methods,
        )

        return [case_atomic, *participant_atomics, *task_atomics], CaseCreationResult(
            case_id=case.id,
            case_code=case.case_code,
            created_at=case.created_at,
        )

    async def create_session_with_participants(
        self,
        center_id: str,
        case_id: str,
        schedule_id: str,
    ) -> tuple[list, SessionCreationResult]:
        session_repo = self._uow.repo(AssessmentSessionRepository)
        session_service = CreateSessionService(session_repo)

        session_atomic, session = await session_service.execute(
            center_id=center_id,
            case_id=case_id,
            schedule_id=schedule_id,
        )

        case_participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)
        list_participants_service = ListCaseParticipantsService(case_participant_repo)
        case_participants = await list_participants_service.execute(case_id)

        from .schemas import CaseParticipantDTO

        participant_dtos = [
            CaseParticipantDTO(
                participant_type=cp.participant_type,
                participant_id=cp.participant_id,
                unassigned_at=cp.unassigned_at,
            )
            for cp in case_participants
        ]

        session_participant_repo = self._uow.repo(
            AssessmentSessionParticipantRepository
        )
        init_service = InitializeSessionParticipantsService(session_participant_repo)

        participant_atomics, _ = await init_service.execute(
            center_id=center_id,
            session_id=session.id,
            case_participants=participant_dtos,
        )

        return [session_atomic, *participant_atomics], SessionCreationResult(
            session_id=session.id,
            status=session.status,
            created_at=session.created_at,
        )

    async def create_cases_bulk(
        self,
        request: BulkCaseCreationRequest,
    ) -> tuple[list, BulkCaseCreationResult]:
        atomics: list = []
        cases = []

        for client_id in request.client_ids:
            (
                case_atomics,
                case_result,
            ) = await self.create_case_with_participants_and_tasks(
                center_id=request.center_id,
                counselor_id=request.counselor_id,
                client_ids=[client_id],
                assessment_ids=request.assessment_ids,
                assessment_summary=[
                    s.model_dump(mode="json") for s in request.assessment_summary
                ],
                assistant_ids=request.assistant_ids,
                set_summary=request.set_summary.model_dump(mode="json")
                if request.set_summary
                else None,
                institution_summary=request.institution_summary,
                tags=request.tags,
                is_final_report_required=request.is_final_report_required,
            )

            atomics.extend(case_atomics)
            cases.append(case_result)

        return atomics, BulkCaseCreationResult(
            cases=cases,
            total_count=len(cases),
        )

    async def create_sessions_bulk(
        self,
        request: BulkSessionCreationRequest,
    ) -> tuple[list, BulkSessionCreationResult]:
        atomics = []
        sessions = []

        for case_id in request.case_ids:
            (
                session_atomics,
                session_result,
            ) = await self.create_session_with_participants(
                center_id=request.center_id,
                case_id=case_id,
                schedule_id=request.schedule_id,
            )

            atomics.extend(session_atomics)
            sessions.append(session_result)

        return atomics, BulkSessionCreationResult(
            sessions=sessions,
            total_count=len(sessions),
        )

    async def get_case_codes_by_ids(
        self,
        case_ids: list[str],
    ) -> dict[str, str]:
        if not case_ids:
            return {}
        case_repo = self._uow.repo(AssessmentCaseRepository)
        service = ListCasesByIdsService(case_repo)
        cases = await service.execute(case_ids)
        return {c.id: c.case_code for c in cases if c.case_code}

    async def get_assessment_case_summaries_by_ids(
        self,
        case_ids: list[str],
    ) -> dict[str, str]:
        return await self.get_case_codes_by_ids(case_ids)

    async def get_client_ids_by_schedule_ids(
        self,
        schedule_ids: list[str],
    ) -> dict[str, list[str]]:
        if not schedule_ids:
            return {}

        session_repo = self._uow.repo(AssessmentSessionRepository)
        find_map_service = AggregateActiveCaseMapByScheduleIdsService(session_repo)
        schedule_to_case = await find_map_service.execute(schedule_ids)
        if not schedule_to_case:
            return {}

        clients_by_case = await self.aggregate_client_ids_by_case_ids(
            list(set(schedule_to_case.values()))
        )
        return {
            sid: clients_by_case.get(cid, []) for sid, cid in schedule_to_case.items()
        }

    async def get_case_by_id(
        self,
        center_id: str,
        case_id: str,
    ) -> AssessmentCase:
        repo = self._uow.repo(AssessmentCaseRepository)
        service = GetAssessmentCaseService(repo)
        return await service.execute(center_id, case_id)

    async def get_cases_by_ids(self, case_ids: list[str]) -> list[AssessmentCase]:
        if not case_ids:
            return []
        from ..assessment_case.services import ListCasesByIdsService

        repo = self._uow.repo(AssessmentCaseRepository)
        service = ListCasesByIdsService(repo)
        return await service.execute(case_ids)

    async def list_cases(
        self,
        center_id: str,
        status: str | None = None,
        counselor_id: str | None = None,
        search: str | None = None,
        sort_order: str = "desc",
        has_institution: bool | None = None,
        date_from=None,
        date_to=None,
        case_ids_filter: list[str] | None = None,
        has_schedule: bool | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[AssessmentCase], Page]:
        repo = self._uow.repo(AssessmentCaseRepository)
        service = ListAssessmentCasesService(repo)
        return await service.execute(
            center_id,
            status=status,
            counselor_id=counselor_id,
            search=search,
            sort_order=sort_order,
            has_institution=has_institution,
            date_from=date_from,
            date_to=date_to,
            case_ids_filter=case_ids_filter,
            has_schedule=has_schedule,
            page=page,
            size=size,
        )

    async def update_case_metadata(
        self,
        center_id: str,
        case_id: str,
        tags: list[str] | None = None,
        is_final_report_required: bool | None = None,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        from ..assessment_case.services import UpdateAssessmentCaseService

        repo = self._uow.repo(AssessmentCaseRepository)
        service = UpdateAssessmentCaseService(repo)

        return await service.execute(
            center_id=center_id,
            case_id=case_id,
            tags=tags,
            is_final_report_required=is_final_report_required,
        )

    async def update_counselor_id(
        self,
        center_id: str,
        case_id: str,
        new_counselor_id: str,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        repo = self._uow.repo(AssessmentCaseRepository)
        service = UpdateCaseCounselorService(repo)
        return await service.execute(center_id, case_id, new_counselor_id)

    async def update_set_summary(
        self,
        center_id: str,
        case_id: str,
        set_id: str,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        set_summary = await self.get_set_summary(center_id, set_id)

        repo = self._uow.repo(AssessmentCaseRepository)
        service = UpdateCaseSetSummaryService(repo)
        return await service.execute(
            center_id, case_id, set_summary.model_dump(mode="json")
        )

    async def update_assessment_summary(
        self,
        center_id: str,
        case_id: str,
        assessment_ids: list[str],
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        new_summary = await self.get_assessment_summaries(assessment_ids)

        repo = self._uow.repo(AssessmentCaseRepository)
        service = UpdateCaseAssessmentSummaryService(repo)
        return await service.execute(
            center_id, case_id, [s.model_dump(mode="json") for s in new_summary]
        )

    async def update_institution_summary(
        self,
        center_id: str,
        case_id: str,
        institution_summary: dict,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        repo = self._uow.repo(AssessmentCaseRepository)
        service = UpdateCaseInstitutionSummaryService(repo)
        return await service.execute(center_id, case_id, institution_summary)

    async def cancel_case(
        self,
        center_id: str,
        case_id: str,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        from ..assessment_case.services import CancelAssessmentCaseService
        from ..assessment_case.repository import AssessmentCaseRepository

        repo = self._uow.repo(AssessmentCaseRepository)
        service = CancelAssessmentCaseService(repo)

        return await service.execute(center_id, case_id)

    async def delete_case(
        self,
        center_id: str,
        case_id: str,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        from ..assessment_case.services import DeleteAssessmentCaseService

        repo = self._uow.repo(AssessmentCaseRepository)
        service = DeleteAssessmentCaseService(repo)
        return await service.execute(center_id, case_id)

    async def delete_participants_by_case(
        self,
        case_id: str,
    ) -> tuple[list, int]:
        repo = self._uow.repo(AssessmentCaseParticipantRepository)
        return await RemoveParticipantsByCaseService(repo).execute(case_id)

    async def revert_cancel_case(
        self,
        center_id: str,
        case_id: str,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        from ..assessment_case.services import RevertCancelAssessmentCaseService

        repo = self._uow.repo(AssessmentCaseRepository)
        service = RevertCancelAssessmentCaseService(repo)
        return await service.execute(center_id, case_id)

    async def get_sessions_by_case_id(
        self,
        case_id: str,
    ) -> list:
        from ..assessment_session.repository import AssessmentSessionRepository

        repo = self._uow.repo(AssessmentSessionRepository)
        service = ListSessionsByCaseIdsService(repo)
        return await service.execute([case_id])

    async def get_tasks_by_case_id(
        self,
        case_id: str,
    ) -> list[str]:
        from ..assessment_task.repository import AssessmentTaskRepository

        repo = self._uow.repo(AssessmentTaskRepository)
        service = ListTasksByCaseService(repo)
        tasks = await service.execute(case_id)
        return [task.assessment_id for task in tasks]

    async def validate_case_update(
        self,
        center_id: str,
        case_id: str,
        data: AssessmentCaseUpdate,
    ) -> UpdateValidationResult:
        case_repo = self._uow.repo(AssessmentCaseRepository)
        get_case_service = GetAssessmentCaseService(case_repo)
        case = await get_case_service.execute(center_id, case_id)

        all_conflicts = []
        all_warnings = []
        all_affected = {
            "tasks_to_cancel": [],
            "tasks_to_create": [],
            "sessions_to_cancel": [],
            "sessions_to_create": [],
            "schedules_to_update": [],
            "schedules_to_update_member": [],
            "schedules_to_create": [],
            "participants_to_unassign": [],
            "participants_to_add": [],
        }

        # Session 1회 조회 — counselor/assessment/schedule 분석이 공유한다(재조회 금지)
        session_repo = self._uow.repo(AssessmentSessionRepository)
        list_sessions_service = ListSessionsByCaseIdsService(session_repo)
        case_sessions = await list_sessions_service.execute([case.id])
        active_sessions = [s for s in case_sessions if s.status not in ("cancelled",)]

        if data.assessment_ids is not None:
            task_repo = self._uow.repo(AssessmentTaskRepository)
            analyze_assessment_service = AnalyzeAssessmentChangesService(task_repo)
            conflicts, warnings, affected = await analyze_assessment_service.execute(
                case, data.assessment_ids
            )
            all_conflicts.extend(conflicts)
            all_warnings.extend(warnings)
            all_affected["tasks_to_cancel"].extend(affected["tasks_to_cancel"])
            all_affected["tasks_to_create"].extend(affected["tasks_to_create"])

            all_affected["execution_method"] = "onsite" if active_sessions else "online"

        if data.counselor_id is not None:
            if case.counselor_id != data.counselor_id:
                all_warnings.append(
                    {"type": "counselor_update", "message": "담당 검사자가 변경됩니다"}
                )

                if active_sessions:
                    seen_schedule_ids = set()
                    for session in active_sessions:
                        if (
                            session.schedule_id
                            and session.schedule_id not in seen_schedule_ids
                        ):
                            seen_schedule_ids.add(session.schedule_id)
                            all_affected["schedules_to_update_member"].append(
                                {
                                    "schedule_id": session.schedule_id,
                                    "new_member_id": data.counselor_id,
                                }
                            )
                    all_warnings.append(
                        {
                            "type": "schedule_member_update",
                            "message": "일정의 담당자도 함께 변경됩니다",
                        }
                    )

        if data.set_id is not None:
            current_set_id = (
                case.set_summary.get("set_id") if case.set_summary else None
            )
            if current_set_id != data.set_id:
                all_warnings.append(
                    {
                        "type": "set_summary_update",
                        "message": "검사 세트 요약 정보가 업데이트됩니다",
                    }
                )

        if data.client_ids is not None or data.assistant_ids is not None:
            participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)
            analyze_participant_service = AnalyzeParticipantChangesService(
                participant_repo
            )
            warnings, affected = await analyze_participant_service.execute(
                case=case,
                client_ids=data.client_ids,
                assistant_ids=data.assistant_ids,
            )
            all_warnings.extend(warnings)
            all_affected["participants_to_unassign"].extend(
                affected["participants_to_unassign"]
            )
            all_affected["participants_to_add"].extend(affected["participants_to_add"])

        if data.institution_id is not None:
            current_inst_id = (
                case.institution_summary.get("institution_id")
                if case.institution_summary
                else None
            )
            if current_inst_id != data.institution_id:
                all_warnings.append(
                    {
                        "type": "institution_summary_update",
                        "message": "기관 요약 정보가 업데이트됩니다",
                    }
                )

        if data.schedule is not None:
            analyze_schedule_service = AnalyzeScheduleChangesService(session_repo)
            conflicts, warnings, affected = await analyze_schedule_service.execute(
                case=case,
                has_schedule=data.schedule.has_schedule,
                scheduled_start=data.schedule.scheduled_start,
                scheduled_end=data.schedule.scheduled_end,
                room_id=data.schedule.room_id,
                memo=data.schedule.memo,
            )
            all_conflicts.extend(conflicts)
            all_warnings.extend(warnings)
            all_affected["sessions_to_cancel"].extend(affected["sessions_to_cancel"])
            all_affected["sessions_to_create"].extend(affected["sessions_to_create"])
            all_affected["schedules_to_update"].extend(affected["schedules_to_update"])
            all_affected["schedules_to_create"].extend(affected["schedules_to_create"])
            if affected.get("schedule_id_to_check"):
                all_affected["schedule_id_to_check"] = affected["schedule_id_to_check"]

        can_update = len(all_conflicts) == 0

        return UpdateValidationResult(
            can_update=can_update,
            conflicts=all_conflicts,
            warnings=all_warnings,
            affected_resources=all_affected,
        )

    async def get_cases_by_client(
        self,
        center_id: str,
        client_id: str,
        status: list[str] | None = None,
    ) -> list[AssessmentCase]:
        participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)
        case_ids = await ListCaseIdsByClientService(participant_repo).execute(
            center_id=center_id,
            client_id=client_id,
            active_only=True,
        )

        if not case_ids:
            return []

        case_repo = self._uow.repo(AssessmentCaseRepository)
        cases = await ListCasesByIdsService(case_repo).execute(case_ids)

        if status:
            cases = [c for c in cases if c.status in status]

        cases.sort(key=lambda c: c.created_at, reverse=True)

        return cases
