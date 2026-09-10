from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..assessment_session.repository import AssessmentSessionRepository
from ..assessment_session.services import (
    GetSessionService,
    ListSessionsByScheduleIdsService,
    ListSessionsByCaseIdsService,
    ListSessionsByCaseService,
    CancelSessionService,
    CancelSessionSimpleService,
    RevertCancelSessionService,
    RevertCancelSessionsByCaseService,
    DeleteSessionsByCaseService,
    CountActiveSessionsByScheduleService,
)
from ..assessment_session.events import AssessmentSessionAtomic
from ..assessment_session.models import AssessmentSession
from ..assessment_session.schemas import AssessmentSessionResponse
from ..assessment_session_participant.repository import (
    AssessmentSessionParticipantRepository,
)
from ..assessment_session_participant.services import (
    ListParticipantsBySessionIdsService,
    RemoveParticipantsBySessionIdsService,
    RevertCancelSessionParticipantsService,
)
from ..assessment_case.repository import AssessmentCaseRepository
from ..assessment_case.services import ListCasesByIdsService, VerifyCaseAccessService
from ..assessment_case_participant.repository import AssessmentCaseParticipantRepository
from ..assessment_case_participant.services import ListParticipantsByCaseIdsService
from ..assessment_set.repository import AssessmentSetRepository
from ..assessment_set.services import ListSetsByIdsService


class SessionWithParticipants:
    def __init__(
        self,
        session_id: str,
        schedule_id: str,
        case_id: str | None,
        case_code: str | None,
        case_type: str | None,
        session_number: int | None,
        counselor_id: str | None,
        assessment_summary: list[dict],  # [{code, kor_name, ...}]
        client_participants: list[dict],  # {participant_id, attendance_status}
        status: str | None = None,
        set_id: str | None = None,
        set_name: str | None = None,
        cancel_reason: str | None = None,
        set_assessment_codes: set[str] | None = None,
    ):
        self.session_id = session_id
        self.schedule_id = schedule_id
        self.case_id = case_id
        self.case_code = case_code
        self.case_type = case_type
        self.session_number = session_number
        self.counselor_id = counselor_id
        self.assessment_summary = assessment_summary
        self.client_participants = client_participants
        self.status = status
        self.set_id = set_id
        self.set_name = set_name
        self.cancel_reason = cancel_reason
        self.set_assessment_codes = set_assessment_codes or set()


class AssessmentSessionFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def verify_case_writable(
        self,
        center_id: str,
        case_id: str,
        member_id: str | None,
    ) -> None:
        case_repo = self._uow.repo(AssessmentCaseRepository)
        case_participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)

        await VerifyCaseAccessService(case_repo, case_participant_repo).execute(
            center_id,
            case_id,
            member_id=member_id,
            writable=True,
        )

    async def verify_session_writable(
        self,
        center_id: str,
        session_id: str,
        member_id: str | None,
    ) -> None:
        # 회기 쓰기 권한은 소속 케이스의 주담당에게만 — 참여 검사자는 열람만
        session_repo = self._uow.repo(AssessmentSessionRepository)
        session = await GetSessionService(session_repo).execute(center_id, session_id)

        await self.verify_case_writable(center_id, session.case_id, member_id)

    async def get_sessions_by_schedule_ids(
        self, schedule_ids: list[str]
    ) -> list[SessionWithParticipants]:
        if not schedule_ids:
            return []

        session_repo = self._uow.repo(AssessmentSessionRepository)
        list_sessions_service = ListSessionsByScheduleIdsService(session_repo)
        sessions = await list_sessions_service.execute(schedule_ids)

        if not sessions:
            return []

        case_ids = [s.case_id for s in sessions]
        case_repo = self._uow.repo(AssessmentCaseRepository)
        list_cases_service = ListCasesByIdsService(case_repo)
        cases = await list_cases_service.execute(case_ids)
        case_map = {c.id: c for c in cases}

        case_participant_repo = self._uow.repo(AssessmentCaseParticipantRepository)
        list_case_participants_service = ListParticipantsByCaseIdsService(
            case_participant_repo
        )
        case_participants = await list_case_participants_service.execute(case_ids)

        case_to_client_count: dict[str, int] = {}
        for cp in case_participants:
            if cp.participant_type == "client" and cp.unassigned_at is None:
                case_to_client_count[cp.case_id] = (
                    case_to_client_count.get(cp.case_id, 0) + 1
                )

        session_ids = [s.id for s in sessions]
        participant_repo = self._uow.repo(AssessmentSessionParticipantRepository)
        list_session_participants_service = ListParticipantsBySessionIdsService(
            participant_repo
        )
        participants = await list_session_participants_service.execute(session_ids)

        session_to_participants: dict[str, list] = {sid: [] for sid in session_ids}
        for p in participants:
            if p.participant_type == "client":
                session_to_participants[p.session_id].append(
                    {
                        "participant_id": p.participant_id,
                        "attendance_status": p.attendance_status,
                    }
                )

        set_ids = list(
            {
                case.set_summary["set_id"]
                for case in cases
                if case.set_summary and case.set_summary.get("set_id")
            }
        )
        set_code_map: dict[str, set[str]] = {}
        if set_ids:
            set_repo = self._uow.repo(AssessmentSetRepository)
            assessment_sets = await ListSetsByIdsService(set_repo).execute(set_ids)
            for s in assessment_sets:
                set_code_map[s.id] = {
                    a["code"] for a in (s.assessment_summary or []) if "code" in a
                }

        result = []
        for session in sessions:
            case = case_map.get(session.case_id)
            case_code = case.case_code if case else None
            counselor_id = case.counselor_id if case else None
            assessment_summary = case.assessment_summary if case else []
            set_name = (
                case.set_summary.get("name") if case and case.set_summary else None
            )
            set_id = (
                case.set_summary.get("set_id") if case and case.set_summary else None
            )
            set_assessment_codes = set_code_map.get(set_id) if set_id else None

            client_count = case_to_client_count.get(session.case_id, 0)
            if client_count == 1:
                case_type = "individual"
            elif client_count == 2:
                case_type = "couple"
            elif client_count >= 3:
                case_type = "group"
            else:
                case_type = None

            result.append(
                SessionWithParticipants(
                    session_id=session.id,
                    schedule_id=session.schedule_id,
                    case_id=session.case_id,
                    case_code=case_code,
                    case_type=case_type,
                    session_number=1,  # 간단히 1로 설정 (TODO: 향후 정확한 계산 필요)
                    counselor_id=counselor_id,
                    assessment_summary=assessment_summary,
                    client_participants=session_to_participants[session.id],
                    status=session.status,
                    set_id=set_id,
                    set_name=set_name,
                    cancel_reason=session.cancel_reason,
                    set_assessment_codes=set_assessment_codes,
                )
            )

        return result

    async def get_sessions_by_case_ids(self, case_ids: list[str]):
        if not case_ids:
            return []

        session_repo = self._uow.repo(AssessmentSessionRepository)
        service = ListSessionsByCaseIdsService(session_repo)
        return await service.execute(case_ids)

    async def cancel_session(
        self,
        center_id: str,
        session_id: str,
        cancel_reason: str | None = None,
    ) -> tuple[AssessmentSessionAtomic, AssessmentSession]:
        session_repo = self._uow.repo(AssessmentSessionRepository)
        cancel_service = CancelSessionService(session_repo)
        return await cancel_service.execute(center_id, session_id, cancel_reason)

    async def cancel_sessions(
        self,
        session_ids: list[str],
    ) -> tuple[list[AssessmentSessionAtomic], int]:
        session_repo = self._uow.repo(AssessmentSessionRepository)
        cancel_service = CancelSessionSimpleService(session_repo)
        atomics: list[AssessmentSessionAtomic] = []
        cancelled_count = 0

        for session_id in session_ids:
            atomic, session = await cancel_service.execute(session_id)
            if session:
                atomics.append(atomic)
                cancelled_count += 1

        return atomics, cancelled_count

    async def revert_cancel_session(
        self,
        center_id: str,
        session_id: str,
    ) -> tuple[AssessmentSessionAtomic, AssessmentSession]:
        session_repo = self._uow.repo(AssessmentSessionRepository)
        revert_service = RevertCancelSessionService(session_repo)
        return await revert_service.execute(center_id, session_id)

    async def list_sessions_by_case(self, case_id: str) -> list[AssessmentSession]:
        session_repo = self._uow.repo(AssessmentSessionRepository)
        return await ListSessionsByCaseService(session_repo).execute(case_id)

    async def delete_sessions_and_participants(
        self,
        case_id: str,
    ) -> tuple[list[AssessmentSessionAtomic], list[str]]:
        # cascade ⓐ: schedule id가 필요하니 조회(list) 먼저 → remove.
        session_repo = self._uow.repo(AssessmentSessionRepository)
        sessions = await ListSessionsByCaseService(session_repo).execute(case_id)

        schedule_ids = [s.schedule_id for s in sessions if s.schedule_id]
        session_ids = [s.id for s in sessions]

        atomics, _count = await DeleteSessionsByCaseService(session_repo).execute(
            case_id
        )

        if session_ids:
            participant_repo = self._uow.repo(AssessmentSessionParticipantRepository)
            await RemoveParticipantsBySessionIdsService(participant_repo).execute(
                session_ids
            )

        return atomics, schedule_ids

    async def revert_cancel_sessions_by_case(
        self,
        case_id: str,
    ) -> tuple[list[AssessmentSessionAtomic], list[AssessmentSession]]:
        session_repo = self._uow.repo(AssessmentSessionRepository)
        return await RevertCancelSessionsByCaseService(session_repo).execute(case_id)

    async def revert_cancel_session_participants(self, session_ids: list[str]) -> int:
        if not session_ids:
            return 0

        participant_repo = self._uow.repo(AssessmentSessionParticipantRepository)
        return await RevertCancelSessionParticipantsService(participant_repo).execute(
            session_ids
        )

    async def get_participants_by_session_ids(
        self,
        session_ids: list[str],
    ) -> list:
        if not session_ids:
            return []

        participant_repo = self._uow.repo(AssessmentSessionParticipantRepository)
        service = ListParticipantsBySessionIdsService(participant_repo)
        return await service.execute(session_ids)

    async def count_active_sessions_by_schedule(
        self,
        schedule_id: str,
        exclude_session_ids: list[str] | None = None,
    ) -> int:
        session_repo = self._uow.repo(AssessmentSessionRepository)
        service = CountActiveSessionsByScheduleService(session_repo)
        return await service.execute(schedule_id, exclude_session_ids)
