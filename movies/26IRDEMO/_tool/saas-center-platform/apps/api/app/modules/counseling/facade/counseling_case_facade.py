from datetime import datetime

from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.core.type import unset
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..counseling_case.events import CounselingCaseAtomic
from ..counseling_case.models import CounselingCase
from ..counseling_case.schemas import (
    CounselingCaseUpdate,
    CounselingCaseResponse,
    CounselingCaseSummary,
    CounselingCaseListResponse,
)
from ..counseling_case.repository import CounselingCaseRepository
from ..counseling_case.schemas import (
    CreateCounselingCaseCommand,
)
from ..counseling_case.services import (
    AggregateCasesByCounselorSummaryService,
    AggregateTopProgramService,
    CreateCounselingCaseService,
    FindRecentDuplicateCaseService,
    GetCounselingCaseService,
    ListCaseIdsByCounselorFieldService,
    UpdateCounselingCaseService,
    DeleteCounselingCaseService,
    ListCounselingCasesService,
    UpdateCaseSnapshotService,
    ListCasesByIdsService,
    VerifyCaseReadableService,
)
from ..counseling_case_participant.schemas import (
    CounselingCaseParticipantCreate,
    CounselingCaseParticipantResponse,
    CounselingCaseParticipantListResponse,
    CaseParticipantType,
)
from ..counseling_case_participant.repository import CounselingCaseParticipantRepository
from ..counseling_case_participant.services import (
    AddParticipantService,
    LeaveParticipantService,
    ListAllClientIdsByCaseIdsService,
    ListCaseIdsByCounselorMemberService,
    ListParticipantsService,
    GetParticipantService,
    AggregateActiveCounselorsByCaseIdsService,
    AggregateActiveClientsByCaseIdsService,
)
from ..counseling_case_participant.services.list_participants_by_cases import (
    ListParticipantsByCasesService,
)

from ..counseling_session.repository import CounselingSessionRepository
from ..counseling_session.services import (
    ListScheduledSessionsService,
    ListSessionsService,
    AggregateActiveCaseMapByScheduleIdsService,
)
from app.modules.counseling.counseling_case_participant.schemas import (
    CaseParticipantType,
)


class CounselingCaseFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def aggregate_top_program(
        self,
        center_id: str,
        counselor_id: str,
        *,
        since: datetime,
    ) -> str | None:
        repo = self._uow.repo(CounselingCaseRepository)
        return await AggregateTopProgramService(repo).execute(
            center_id=center_id,
            counselor_id=counselor_id,
            since=since,
        )

    async def list_client_ids_by_counselor(
        self,
        center_id: str,
        counselor_id: str,
    ) -> set[str]:
        # 담당 범위(넓게): 주담당(case.counselor_id) + 공동 상담사 케이스 모두, 상태·참여 활성 무관(과거 포함)
        case_repo = self._uow.repo(CounselingCaseRepository)
        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)

        primary_ids = await ListCaseIdsByCounselorFieldService(case_repo).execute(
            center_id=center_id,
            counselor_id=counselor_id,
        )
        secondary_ids = await ListCaseIdsByCounselorMemberService(
            participant_repo
        ).execute(
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

    async def list_accessible_case_ids(
        self,
        center_id: str,
        member_id: str,
    ) -> list[str]:
        # 열람 범위 = 주담당(case.counselor_id) + 현재 활성 공동 상담사. 쓰기 범위(주담당 전용)와 다르다.
        case_repo = self._uow.repo(CounselingCaseRepository)
        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)

        primary_ids = await ListCaseIdsByCounselorFieldService(case_repo).execute(
            center_id=center_id,
            counselor_id=member_id,
        )
        participating_ids = await ListCaseIdsByCounselorMemberService(
            participant_repo
        ).execute(
            center_id=center_id,
            member_id=member_id,
            active_only=True,
        )

        return list({*primary_ids, *participating_ids})

    async def verify_case_readable(
        self,
        case_id: str,
        center_id: str,
        member_id: str | None,
    ) -> None:
        case_repo = self._uow.repo(CounselingCaseRepository)
        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)

        await VerifyCaseReadableService(case_repo, participant_repo).execute(
            case_id,
            center_id,
            member_id=member_id,
        )

    async def get_case_by_id(
        self,
        case_id: str,
        center_id: str,
        counselor_id: str | None = None,
    ) -> CounselingCase:
        case_repo = self._uow.repo(CounselingCaseRepository)
        service = GetCounselingCaseService(case_repo)
        return await service.execute(case_id, center_id, counselor_id)

    async def get_case_codes_by_ids(
        self,
        case_ids: list[str],
    ) -> dict[str, str]:
        if not case_ids:
            return {}
        case_repo = self._uow.repo(CounselingCaseRepository)
        service = ListCasesByIdsService(case_repo)
        cases = await service.execute(case_ids)
        return {c.id: c.case_code for c in cases if c.case_code}

    async def get_counseling_case_summaries_by_ids(
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

        session_repo = self._uow.repo(CounselingSessionRepository)
        find_map_service = AggregateActiveCaseMapByScheduleIdsService(session_repo)
        schedule_to_case = await find_map_service.execute(schedule_ids)
        if not schedule_to_case:
            return {}

        clients_by_case = await self.aggregate_active_client_ids_by_case_ids(
            list(set(schedule_to_case.values()))
        )
        return {
            sid: clients_by_case.get(cid, []) for sid, cid in schedule_to_case.items()
        }

    async def get_cases_by_ids(
        self,
        case_ids: list[str],
    ) -> list[CounselingCase]:
        if not case_ids:
            return []
        case_repo = self._uow.repo(CounselingCaseRepository)
        service = ListCasesByIdsService(case_repo)
        return await service.execute(case_ids)

    async def aggregate_cases_by_schedule_ids(
        self,
        schedule_ids: list[str],
    ) -> dict[str, CounselingCase]:
        # 취소/삭제된 세션은 제외 — 대응되는 case가 없으면 키도 없음
        if not schedule_ids:
            return {}

        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

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

    async def aggregate_active_client_ids_by_case_ids(
        self,
        case_ids: list[str],
    ) -> dict[str, list[str]]:
        if not case_ids:
            return {}
        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        service = AggregateActiveClientsByCaseIdsService(participant_repo)
        return await service.execute(case_ids)

    async def aggregate_active_counselor_ids_by_case_ids(
        self,
        case_ids: list[str],
    ) -> dict[str, list[str]]:
        # participant row가 없는 케이스는 dict에 포함되지 않음 — 호출자가 case.counselor_id 로 fallback
        if not case_ids:
            return {}

        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        service = AggregateActiveCounselorsByCaseIdsService(participant_repo)
        return await service.execute(case_ids)

    async def create_case(
        self,
        center_id: str,
        counselor_id: str,
        program_id: str,
        chief_complaint: str | None = None,
        memo: str | None = None,
        total_sessions: int | None = None,
        session_rule: dict | None = None,
    ) -> tuple[CounselingCaseAtomic, CounselingCase]:
        case_repo = self._uow.repo(CounselingCaseRepository)
        service = CreateCounselingCaseService(case_repo)

        command = CreateCounselingCaseCommand(
            center_id=center_id,
            counselor_id=counselor_id,
            program_id=program_id,
            chief_complaint=chief_complaint,
            memo=memo,
            total_sessions=total_sessions,
            session_rule=session_rule,
        )

        return await service.execute(command)

    async def find_duplicate_candidate(
        self,
        center_id: str,
        program_id: str,
        counselor_id: str,
        client_ids: list[str],
        minutes_threshold: int = 5,
    ) -> "DuplicateCaseCandidate | None":
        # 일정(시작·장소) 최종 일치 판정은 Application Handler가 ScheduleFacade로 수행 — 여기서는 schedule을 보지 않는다
        from .schemas import DuplicateCaseCandidate

        case_repo = self._uow.repo(CounselingCaseRepository)
        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        session_repo = self._uow.repo(CounselingSessionRepository)

        duplicate_case = await FindRecentDuplicateCaseService(case_repo).execute(
            center_id,
            program_id=program_id,
            counselor_id=counselor_id,
            minutes_threshold=minutes_threshold,
        )
        if not duplicate_case:
            return None

        duplicate_participants = await ListParticipantsService(
            participant_repo
        ).execute(
            case_id=duplicate_case.id,
            center_id=center_id,
            active_only=True,
        )
        duplicate_client_ids = {
            p.participant_id
            for p in duplicate_participants
            if p.participant_type == CaseParticipantType.CLIENT.value
        }
        if duplicate_client_ids != set(client_ids):
            return None

        duplicate_sessions = await ListSessionsService(session_repo).execute(
            case_id=duplicate_case.id,
            center_id=center_id,
        )
        if not duplicate_sessions:
            return None

        return DuplicateCaseCandidate(
            case_code=duplicate_case.case_code,
            first_schedule_id=duplicate_sessions[0].schedule_id,
        )

    async def get_case_with_response(
        self,
        case_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> CounselingCaseResponse:
        case_repo = self._uow.repo(CounselingCaseRepository)
        service = GetCounselingCaseService(case_repo)

        case = await service.execute(case_id, center_id, counselor_id)

        return CounselingCaseResponse.model_validate(case)

    async def update_case(
        self,
        case_id: str,
        center_id: str,
        owner_scope: str | None,
        *,
        changed: dict,
        counselor_id: str = unset,
        chief_complaint: str | None = unset,
        memo: str | None = unset,
        status: str = unset,
        total_sessions: int | None = unset,
    ):
        from ..counseling_case.schemas import CaseStatus
        from app.core.exceptions import InvalidOperationException

        case_repo = self._uow.repo(CounselingCaseRepository)
        session_repo = self._uow.repo(CounselingSessionRepository)

        if status is not unset and status in [
            CaseStatus.COMPLETED,
            CaseStatus.CANCELLED,
        ]:
            find_scheduled_service = ListScheduledSessionsService(session_repo)
            scheduled_sessions = await find_scheduled_service.execute(case_id)
            if scheduled_sessions:
                raise InvalidOperationException(
                    f"완료되지 않은 회기가 {len(scheduled_sessions)}건 있어요.\n"
                    f"남은 회기를 먼저 완료하거나 취소해 주세요."
                )

        service = UpdateCounselingCaseService(case_repo)
        return await service.execute(
            case_id,
            center_id,
            owner_scope,
            changed=changed,
            counselor_id=counselor_id,
            chief_complaint=chief_complaint,
            memo=memo,
            status=status,
            total_sessions=total_sessions,
        )

    async def delete_case(
        self,
        case_id: str,
        center_id: str,
        counselor_id: str | None,
    ):
        case_repo = self._uow.repo(CounselingCaseRepository)
        service = DeleteCounselingCaseService(case_repo)

        return await service.execute(case_id, center_id, counselor_id)

    async def list_case_ids_by_participant_ids(
        self,
        participant_ids: list[str],
        center_id: str,
    ) -> list[str]:
        from ..counseling_case_participant.services import (
            ListCaseIdsByParticipantIdsService,
        )

        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        service = ListCaseIdsByParticipantIdsService(participant_repo)
        return await service.execute(participant_ids, center_id)

    async def list_cases(
        self,
        center_id: str,
        status: str | None = None,
        counselor_id: str | None = None,
        offset: int = 0,
        limit: int = 20,
        program_ids: list[str] | None = None,
        case_ids: list[str] | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        sort: str = "desc",
    ) -> tuple[list[CounselingCase], int]:
        # RBAC: counselor_id가 None이면 센터 전체, 있으면 본인만
        repo = self._uow.repo(CounselingCaseRepository)
        service = ListCounselingCasesService(repo)

        page = (offset // limit) + 1
        size = limit
        items, page_meta = await service.execute(
            center_id,
            counselor_id,
            status,
            page,
            size,
            program_ids=program_ids,
            case_ids=case_ids,
            start_date=start_date,
            end_date=end_date,
            sort=sort,
        )

        return items, page_meta["total"]

    async def list_all_cases_summary_by_counselor(
        self,
        center_id: str,
        counselor_id: str,
    ) -> list[tuple[str, str]]:
        repo = self._uow.repo(CounselingCaseRepository)
        return await AggregateCasesByCounselorSummaryService(repo).execute(
            center_id=center_id,
            counselor_id=counselor_id,
        )

    async def list_cases_with_response(
        self,
        center_id: str,
        counselor_id: str | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 20,
        program_ids: list[str] | None = None,
        case_ids: list[str] | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        sort: str = "desc",
    ) -> CounselingCaseListResponse:
        import math

        case_repo = self._uow.repo(CounselingCaseRepository)
        service = ListCounselingCasesService(case_repo)

        items, page_meta = await service.execute(
            center_id,
            counselor_id,
            status,
            offset,
            limit,
            program_ids=program_ids,
            case_ids=case_ids,
            start_date=start_date,
            end_date=end_date,
            sort=sort,
        )
        total = page_meta["total"]

        return CounselingCaseListResponse(
            items=[CounselingCaseSummary.model_validate(item) for item in items],
            total=total,
            page=offset,
            size=limit,
            pages=math.ceil(total / limit) if total > 0 else 0,
        )

    async def add_participant(
        self,
        case_id: str,
        center_id: str,
        counselor_id: str | None,
        participant_id: str,
        participant_type: str,
    ):
        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(case_id, center_id, counselor_id)

        add_service = AddParticipantService(participant_repo)
        data = CounselingCaseParticipantCreate(
            participant_id=participant_id,
            participant_type=CaseParticipantType(participant_type),
        )
        atomic, participant = await add_service.execute(
            case_id=case_id,
            center_id=center_id,
            participant_id=data.participant_id,
            participant_type=data.participant_type.value,
        )

        snapshot_atomic = await self._update_participant_snapshot(case_id, center_id)

        return [atomic, snapshot_atomic], participant

    async def leave_participant(
        self,
        case_id: str,
        participant_id: str,
        center_id: str,
        counselor_id: str | None,
    ):
        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_participant_service = GetParticipantService(participant_repo)
        participant = await get_participant_service.execute(participant_id, center_id)

        if participant.counseling_case_id != case_id:
            raise InvalidOperationException(
                f"Participant {participant_id} does not belong to case {case_id}. "
                f"참여자가 해당 케이스에 속하지 않습니다."
            )

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(case_id, center_id, counselor_id)

        leave_service = LeaveParticipantService(participant_repo)
        atomic, participant = await leave_service.execute(participant_id, center_id)

        snapshot_atomic = await self._update_participant_snapshot(case_id, center_id)

        return [atomic, snapshot_atomic], participant

    async def list_participants_with_response(
        self,
        case_id: str,
        center_id: str,
        counselor_id: str | None,
        active_only: bool,
    ) -> CounselingCaseParticipantListResponse:
        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(case_id, center_id, counselor_id)

        list_service = ListParticipantsService(participant_repo)
        participants = await list_service.execute(case_id, center_id, active_only)

        return CounselingCaseParticipantListResponse(
            items=[
                CounselingCaseParticipantResponse.model_validate(p)
                for p in participants
            ]
        )

    async def get_participants_by_case_ids(
        self,
        case_ids: list[str],
        center_id: str,
    ) -> dict[str, list]:
        if not case_ids:
            return {}

        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        list_service = ListParticipantsByCasesService(participant_repo)
        participants = await list_service.execute(case_ids)

        result: dict[str, list] = {}
        for p in participants:
            if p.center_id == center_id:
                if p.counseling_case_id not in result:
                    result[p.counseling_case_id] = []
                result[p.counseling_case_id].append(p)

        return result

    async def _update_participant_snapshot(
        self,
        case_id: str,
        center_id: str,
    ) -> CounselingCaseAtomic:
        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        list_service = ListParticipantsService(participant_repo)
        participants = await list_service.execute(
            case_id=case_id,
            center_id=center_id,
            active_only=True,
        )

        clients = []
        counselors = []
        for p in participants:
            snapshot_item = {
                "participant_id": p.participant_id,
                "participant_type": p.participant_type,
                "joined_at": p.joined_at.isoformat() if p.joined_at else None,
            }
            if p.participant_type == CaseParticipantType.CLIENT.value:
                clients.append(snapshot_item)
            elif p.participant_type == CaseParticipantType.COUNSELOR.value:
                counselors.append(snapshot_item)

        snapshot = {
            "total_participants": len(participants),
            "clients": clients,
            "counselors": counselors,
            "snapshot_at": utc_now().isoformat(),
        }

        update_service = UpdateCaseSnapshotService(case_repo)
        atomic, _ = await update_service.execute(case_id, center_id, snapshot)
        return atomic
