from datetime import datetime

from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.core.type import unset

from ..counseling_case.repository import CounselingCaseRepository
from ..counseling_case.services import (
    GetCounselingCaseService,
    ListCasesByIdsService,
    ListCaseIdsByCounselorService,
    UpdateCaseTotalSessionsService,
    VerifyCaseReadableService,
)

from ..counseling_case_participant.repository import CounselingCaseParticipantRepository
from ..counseling_case_participant.services import (
    ListParticipantsService,
    ListParticipantsByCasesService,
    ListParticipantsByParticipantIdsService,
)

from ..counseling_note.repository import CounselingNoteRepository
from ..counseling_note.services import ListWrittenSessionIdsService

from ..counseling_session.events import CounselingSessionAtomic
from ..counseling_session.models import CounselingSession
from ..counseling_session.schemas import (
    CounselingSessionCreate,
    CounselingSessionUpdate,
    CounselingSessionResponse,
)
from ..counseling_session.repository import CounselingSessionRepository
from ..counseling_session.services import (
    AggregateCompletedSessionsByCaseIdsService,
    CountSessionsByCaseService,
    CreateSessionService,
    GetSessionService,
    UpdateSessionService,
    DeleteSessionService,
    ListSessionsService,
    CancelSessionSimpleService,
    RevertCancelSessionService,
    ListSessionsByScheduleIdsService,
    ListCompletedSessionsByCaseIdsService,
    ListSessionsByScheduleAndCaseIdsService,
)

from ..counseling_session_participant.models import CounselingSessionParticipant
from ..counseling_session_participant.repository import (
    CounselingSessionParticipantRepository,
)
from ..counseling_session_participant.events import SessionParticipantAtomic
from ..counseling_session_participant.schemas import (
    SessionParticipantResponse,
)
from ..counseling_session_participant.services import (
    InitializeSessionParticipantsService,
    AddSessionParticipantsService,
    UpdateAttendanceService,
    ListParticipantsBySessionService,
    GetSessionParticipantByIdService,
    UpdateParticipantByIdService,
    ListParticipantsBySessionIdsService,
    ListAttendancePatternService,
    AttendancePoint,
)


from .schemas import CaseParticipantDTO, UnloggedSession, TodaySession
from app.modules.counseling.counseling_case_participant.schemas import (
    CaseParticipantType,
)
from app.modules.counseling.counseling_session_participant.schemas import (
    ParticipantType,
)


class CounselingSessionFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def create_session(
        self,
        center_id: str,
        counselor_id: str | None,
        counseling_case_id: str,
        schedule_id: str,
        session_number: int | None = None,
    ) -> tuple[list, CounselingSession]:
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)
        case_participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        session_participant_repo = self._uow.repo(
            CounselingSessionParticipantRepository
        )

        get_case_service = GetCounselingCaseService(case_repo)
        case = await get_case_service.execute(
            counseling_case_id, center_id, counselor_id
        )

        if case.status in ["completed", "cancelled"]:
            raise InvalidOperationException(
                f"Cannot create session for a {case.status} case. "
                f"종결 또는 취소된 케이스에는 세션을 생성할 수 없습니다."
            )

        data = CounselingSessionCreate(
            counseling_case_id=counseling_case_id,
            schedule_id=schedule_id,
            session_number=session_number,
        )
        create_service = CreateSessionService(session_repo)
        atomic, session = await create_service.execute(
            center_id=center_id,
            counseling_case_id=data.counseling_case_id,
            schedule_id=data.schedule_id,
            session_number=data.session_number,
        )

        list_case_participant_service = ListParticipantsService(case_participant_repo)
        case_participants = await list_case_participant_service.execute(
            case_id=counseling_case_id,
            center_id=center_id,
            active_only=True,
        )

        participant_dtos = [
            CaseParticipantDTO(
                participant_type=cp.participant_type,
                participant_id=cp.participant_id,
                is_active=cp.is_active,
                left_at=cp.left_at,
            )
            for cp in case_participants
        ]

        init_service = InitializeSessionParticipantsService(session_participant_repo)
        participant_atomics, _ = await init_service.execute(
            center_id=center_id,
            session_id=session.id,
            case_participants=participant_dtos,
        )

        # 총회기는 계약값 — 등록 회기(취소 제외)가 계약을 초과할 때만 자동 확장.
        # 무조건 덮으면 총회기 수기 편집이 회기 추가 시 리셋된다 (하루 대본 D2)
        count_service = CountSessionsByCaseService(session_repo)
        open_total = await count_service.execute(
            case_id=counseling_case_id,
            center_id=center_id,
        )
        total_atomics = []
        if case.total_sessions is None or open_total > case.total_sessions:
            update_total_service = UpdateCaseTotalSessionsService(case_repo)
            total_atomic, _ = await update_total_service.execute(
                case_id=counseling_case_id,
                center_id=center_id,
                total_sessions=open_total,
            )
            total_atomics.append(total_atomic)

        return [atomic, *participant_atomics, *total_atomics], session

    async def verify_case_readable(
        self,
        case_id: str,
        center_id: str,
        member_id: str | None,
    ) -> None:
        case_repo = self._uow.repo(CounselingCaseRepository)
        case_participant_repo = self._uow.repo(CounselingCaseParticipantRepository)

        await VerifyCaseReadableService(case_repo, case_participant_repo).execute(
            case_id,
            center_id,
            member_id=member_id,
        )

    async def verify_session_participant_writable(
        self,
        session_participant_id: str,
        center_id: str,
        member_id: str | None,
    ) -> None:
        # 회기 참여자 쓰기는 소속 케이스 주담당 전용 — 공동 상담사는 열람만
        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)
        participant = await GetSessionParticipantByIdService(participant_repo).execute(
            session_participant_id,
            center_id,
        )

        session_repo = self._uow.repo(CounselingSessionRepository)
        session = await GetSessionService(session_repo).execute(
            participant.session_id, center_id
        )

        case_repo = self._uow.repo(CounselingCaseRepository)
        await GetCounselingCaseService(case_repo).execute(
            session.counseling_case_id, center_id, member_id
        )

    async def verify_session_readable(
        self,
        session_id: str,
        center_id: str,
        member_id: str | None,
    ) -> None:
        session_repo = self._uow.repo(CounselingSessionRepository)
        session = await GetSessionService(session_repo).execute(session_id, center_id)

        await self.verify_case_readable(
            session.counseling_case_id, center_id, member_id
        )

    async def get_session_with_response(
        self,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> CounselingSessionResponse:
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        return CounselingSessionResponse.model_validate(session)

    async def update_session(
        self,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
        changed: dict,
        status: str | None = None,
    ) -> tuple[list, CounselingSession]:
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)
        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        data = CounselingSessionUpdate(status=status)
        update_service = UpdateSessionService(session_repo)
        atomic, updated_session = await update_service.execute(
            session_id=session_id,
            center_id=center_id,
            changed=changed,
            status=data.status.value if data.status is not None else None,
        )
        atomics = [atomic]

        # 완료·노쇼 시 출결 미입력(scheduled)만 같은 값으로 — 개별 출결(불참·노쇼)은 보존.
        # 회기 차감(is_consumed)은 센터 정책이라 여기서 건드리지 않는다.
        # str Enum 멤버는 문자열과 해시가 달라 dict 키로 못 쓴다 — 값으로 매핑
        cascade_attendance = {
            CounselingSessionStatus.COMPLETED.value: "attended",
            CounselingSessionStatus.NO_SHOW.value: "no_show",
        }.get(status)
        if cascade_attendance:
            list_participants_service = ListParticipantsBySessionService(
                participant_repo
            )
            participants = await list_participants_service.execute(
                session_id, center_id
            )
            update_attendance_service = UpdateAttendanceService(participant_repo)
            for participant in participants:
                if (
                    participant.participant_type == ParticipantType.CLIENT.value
                    and participant.attendance_status == "scheduled"
                ):
                    attendance_atomic, _ = await update_attendance_service.execute(
                        session_id=session_id,
                        participant_type=ParticipantType.CLIENT,
                        participant_id=participant.participant_id,
                        attendance_status=cascade_attendance,
                        memo=participant.memo,
                    )
                    atomics.append(attendance_atomic)

        return atomics, updated_session

    async def delete_session(
        self,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> tuple[list, str | None]:
        # 회기와 1:1 연결된 Schedule은 타 모듈이라 여기서 안 지움 — soft-delete는 Application Handler가 조합
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        case = await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        schedule_id = session.schedule_id
        delete_service = DeleteSessionService(session_repo)
        atomic, _ = await delete_service.execute(session_id, center_id)

        # 삭제 시 계약값(총회기)은 줄이지 않는다 — 축소는 총회기 편집으로만. 미설정이면 채움
        total_atomics = []
        if case.total_sessions is None:
            count_service = CountSessionsByCaseService(session_repo)
            open_total = await count_service.execute(
                case_id=session.counseling_case_id,
                center_id=center_id,
            )
            case_repo = self._uow.repo(CounselingCaseRepository)
            update_total_service = UpdateCaseTotalSessionsService(case_repo)
            total_atomic, _ = await update_total_service.execute(
                case_id=session.counseling_case_id,
                center_id=center_id,
                total_sessions=open_total,
            )
            total_atomics.append(total_atomic)

        return [atomic, *total_atomics], schedule_id

    async def list_sessions_with_response(
        self,
        case_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> list[CounselingSessionResponse]:
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(case_id, center_id, counselor_id)

        list_service = ListSessionsService(session_repo)
        sessions = await list_service.execute(case_id, center_id)

        return [CounselingSessionResponse.model_validate(s) for s in sessions]

    async def update_attendance_with_response(
        self,
        session_id: str,
        participant_type: str,
        participant_id: str,
        center_id: str,
        counselor_id: str | None,
        attendance_status: str = unset,
        is_consumed: bool = unset,
        memo: str | None = unset,
        changed: dict | None = None,
    ) -> tuple[SessionParticipantAtomic, SessionParticipantResponse]:
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)
        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        update_service = UpdateAttendanceService(participant_repo)
        atomic, participant = await update_service.execute(
            session_id=session_id,
            participant_type=participant_type,
            participant_id=participant_id,
            attendance_status=attendance_status,
            is_consumed=is_consumed,
            memo=memo,
            changed=changed,
        )

        return atomic, SessionParticipantResponse.model_validate(participant)

    async def update_participant_by_id(
        self,
        session_participant_id: str,
        center_id: str,
        counselor_id: str | None,
        attendance_status: str = unset,
        is_consumed: bool = unset,
        memo: str | None = unset,
        changed: dict | None = None,
    ) -> tuple[SessionParticipantAtomic, CounselingSessionParticipant]:
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)
        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)

        get_participant_service = GetSessionParticipantByIdService(participant_repo)
        participant = await get_participant_service.execute(
            session_participant_id, center_id
        )

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(participant.session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        update_service = UpdateParticipantByIdService(participant_repo)
        fields = {
            "attendance_status": attendance_status,
            "is_consumed": is_consumed,
            "memo": memo,
        }
        atomic, updated_participant = await update_service.execute(
            session_participant_id=session_participant_id,
            center_id=center_id,
            changed=changed
            if changed is not None
            else {key: value for key, value in fields.items() if value is not unset},
            **fields,
        )

        return atomic, updated_participant

    async def add_session_participants(
        self,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
        client_ids: list[str] | None = None,
        counselor_ids: list[str] | None = None,
    ) -> tuple[list[SessionParticipantAtomic], list[CounselingSessionParticipant]]:
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)
        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        add_service = AddSessionParticipantsService(participant_repo)
        atomics, participants = await add_service.execute(
            center_id=center_id,
            session_id=session_id,
            client_ids=client_ids,
            counselor_ids=counselor_ids,
        )

        return atomics, participants

    async def list_participants_with_response(
        self,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> list[SessionParticipantResponse]:
        # participant_name/gender/birth_date 등 타 모듈(Client/Member) 필드는 Application Handler가 조립
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)
        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        list_service = ListParticipantsBySessionService(participant_repo)
        participants = await list_service.execute(
            session_id=session_id,
            center_id=center_id,
        )

        return [SessionParticipantResponse.model_validate(p) for p in participants]

    async def get_participants_by_session_id(
        self,
        session_id: str,
        center_id: str,
    ) -> list:
        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)
        list_service = ListParticipantsBySessionService(participant_repo)

        return await list_service.execute(
            session_id=session_id,
            center_id=center_id,
        )

    async def cancel_session(
        self,
        session_id: str,
        center_id: str,
    ) -> CounselingSessionAtomic:
        session_repo = self._uow.repo(CounselingSessionRepository)
        cancel_service = CancelSessionSimpleService(session_repo)

        atomic, _ = await cancel_service.execute(
            session_id=session_id,
            center_id=center_id,
        )
        return atomic

    async def cancel_session_with_reason(
        self,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
        cancel_reason: str | None = None,
    ) -> tuple[CounselingSessionAtomic, CounselingSession]:
        # 이름이 cancel_session 아닌 까닭: bare cancel_session(audit 없는 cross-module no-op
        # variant)이 점유돼 있다. 발행 경로(handler가 직렬화)는 이 메서드.
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        cancel_service = CancelSessionSimpleService(session_repo)
        atomic, cancelled_session = await cancel_service.execute(
            session_id, center_id, cancel_reason=cancel_reason
        )

        return atomic, cancelled_session

    async def revert_cancel_session(
        self,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> tuple[CounselingSessionAtomic, CounselingSession]:
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        revert_service = RevertCancelSessionService(session_repo)
        return await revert_service.execute(session_id, center_id)

    async def initialize_session_participants(
        self,
        session_id: str,
        center_id: str,
        counselor_id: str,
        client_ids: list[str],
    ) -> tuple[list[SessionParticipantAtomic], list[CounselingSessionParticipant]]:
        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)

        from .schemas import CaseParticipantDTO

        participant_dtos = []

        participant_dtos.append(
            CaseParticipantDTO(
                participant_type=CaseParticipantType.COUNSELOR,
                participant_id=counselor_id,
                is_active=True,
                left_at=None,
            )
        )

        for client_id in client_ids:
            participant_dtos.append(
                CaseParticipantDTO(
                    participant_type=CaseParticipantType.CLIENT,
                    participant_id=client_id,
                    is_active=True,
                    left_at=None,
                )
            )

        init_service = InitializeSessionParticipantsService(participant_repo)
        return await init_service.execute(
            center_id=center_id,
            session_id=session_id,
            case_participants=participant_dtos,
        )

    async def get_sessions_by_case_ids(
        self,
        case_ids: list[str],
    ) -> list[CounselingSession]:
        if not case_ids:
            return []

        session_repo = self._uow.repo(CounselingSessionRepository)

        from ..counseling_session.services import ListSessionsByCasesService

        list_service = ListSessionsByCasesService(session_repo)
        sessions = await list_service.execute(case_ids)

        return sessions

    async def get_sessions_by_ids(
        self,
        session_ids: list[str],
        center_id: str,
    ) -> list[CounselingSession]:
        if not session_ids:
            return []

        session_repo = self._uow.repo(CounselingSessionRepository)

        from ..counseling_session.services import GetSessionsByIdsService

        service = GetSessionsByIdsService(session_repo)
        return await service.execute(session_ids, center_id)

    async def get_participants_by_session_ids(
        self,
        session_ids: list[str],
    ) -> list:
        if not session_ids:
            return []

        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)
        service = ListParticipantsBySessionIdsService(participant_repo)
        return await service.execute(session_ids)

    async def list_case_ids_by_schedule_ids(
        self,
        schedule_ids: list[str],
    ) -> list[str]:
        if not schedule_ids:
            return []

        session_repo = self._uow.repo(CounselingSessionRepository)

        from ..counseling_session.services import ListCaseIdsByScheduleIdsService

        service = ListCaseIdsByScheduleIdsService(session_repo)
        return await service.execute(schedule_ids)

    async def count_completed_sessions(
        self,
        case_ids: list[str],
    ) -> tuple[int, datetime | None]:
        if not case_ids:
            return 0, None

        session_repo = self._uow.repo(CounselingSessionRepository)
        return await AggregateCompletedSessionsByCaseIdsService(session_repo).execute(
            case_ids
        )

    async def get_sessions_by_schedule_ids(
        self, schedule_ids: list[str]
    ) -> list["CounselingSessionWithParticipants"]:
        # Assessment의 SessionWithParticipants와 동일한 인터페이스(duck typing)
        if not schedule_ids:
            return []

        session_repo = self._uow.repo(CounselingSessionRepository)
        list_sessions_service = ListSessionsByScheduleIdsService(session_repo)
        sessions = await list_sessions_service.execute(schedule_ids)

        if not sessions:
            return []

        case_ids = list({s.counseling_case_id for s in sessions})
        case_repo = self._uow.repo(CounselingCaseRepository)
        list_cases_service = ListCasesByIdsService(case_repo)
        cases = await list_cases_service.execute(case_ids)
        case_map = {c.id: c for c in cases}

        case_participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        list_case_participants_service = ListParticipantsByCasesService(
            case_participant_repo
        )
        case_participants = await list_case_participants_service.execute(case_ids)

        case_to_client_count: dict[str, int] = {}
        for cp in case_participants:
            if cp.participant_type == CaseParticipantType.CLIENT.value and cp.is_active:
                case_to_client_count[cp.counseling_case_id] = (
                    case_to_client_count.get(cp.counseling_case_id, 0) + 1
                )

        session_ids = [s.id for s in sessions]
        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)
        list_session_participants_service = ListParticipantsBySessionIdsService(
            participant_repo
        )
        participants = await list_session_participants_service.execute(session_ids)

        session_to_participants: dict[str, list] = {sid: [] for sid in session_ids}
        for p in participants:
            if p.participant_type == ParticipantType.CLIENT.value:
                session_to_participants[p.session_id].append(
                    {
                        "participant_id": p.participant_id,
                        "attendance_status": p.attendance_status,
                    }
                )

        result = []
        for session in sessions:
            case = case_map.get(session.counseling_case_id)
            case_code = case.case_code if case else None
            counselor_id = case.counselor_id if case else None

            # case_type을 참여 내담자 수로 추론 (1=individual, 2=couple, 3+=group)
            client_count = case_to_client_count.get(session.counseling_case_id, 0)
            if client_count == 1:
                case_type = "individual"
            elif client_count == 2:
                case_type = "couple"
            elif client_count >= 3:
                case_type = "group"
            else:
                case_type = None

            result.append(
                CounselingSessionWithParticipants(
                    session_id=session.id,
                    schedule_id=session.schedule_id,
                    case_id=session.counseling_case_id,
                    case_code=case_code,
                    case_type=case_type,
                    session_number=session.session_number,
                    counselor_id=counselor_id,
                    assessment_summary=[],
                    client_participants=session_to_participants[session.id],
                    status=session.status,
                    program_id=case.program_id if case else None,
                    cancel_reason=session.cancel_reason,
                )
            )

        return result

    async def get_session(
        self,
        session_id: str,
        center_id: str,
    ) -> CounselingSession:
        session_repo = self._uow.repo(CounselingSessionRepository)
        get_session_service = GetSessionService(session_repo)
        return await get_session_service.execute(session_id, center_id)

    async def delete_session_participants_by_type(
        self,
        session_id: str,
        participant_type: str,
    ) -> tuple[list[SessionParticipantAtomic], int]:
        from ..counseling_session_participant.services import (
            DeleteSessionParticipantsByTypeService,
        )

        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)
        service = DeleteSessionParticipantsByTypeService(participant_repo)
        return await service.execute(session_id, participant_type)

    async def _build_case_to_client_map(
        self,
        center_id: str,
        client_ids: list[str],
    ) -> dict[str, str]:
        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        participants = await ListParticipantsByParticipantIdsService(
            participant_repo
        ).execute(
            participant_ids=client_ids,
            center_id=center_id,
            active_only=True,
            participant_type=CaseParticipantType.CLIENT,
        )
        return {p.counseling_case_id: p.participant_id for p in participants}

    async def aggregate_latest_unlogged_per_client(
        self,
        center_id: str,
        client_ids: list[str],
    ) -> dict[str, UnloggedSession]:
        # client_id별 일지 미작성(status='completed' AND note 없음) 완료 회기 1개(최근)
        if not client_ids:
            return {}

        case_to_client = await self._build_case_to_client_map(center_id, client_ids)
        if not case_to_client:
            return {}

        session_repo = self._uow.repo(CounselingSessionRepository)
        completed = await ListCompletedSessionsByCaseIdsService(session_repo).execute(
            list(case_to_client.keys())
        )
        if not completed:
            return {}

        note_repo = self._uow.repo(CounselingNoteRepository)
        written = await ListWrittenSessionIdsService(note_repo).execute(
            [s.id for s in completed]
        )

        result: dict[str, UnloggedSession] = {}
        for s in completed:
            if s.id in written or s.completed_at is None:
                continue
            client_id = case_to_client.get(s.counseling_case_id)
            if not client_id:
                continue
            existing = result.get(client_id)
            if existing is None or s.completed_at > existing.completed_at:
                result[client_id] = UnloggedSession(
                    session_id=s.id, completed_at=s.completed_at
                )
        return result

    async def list_completed_sessions_by_counselor(
        self,
        center_id: str,
        counselor_id: str,
    ) -> list[CounselingSession]:
        # 본 상담사 담당 케이스의 완료 회기 전체(노트 유무 무관) — 상담일지 리스트 'missing' 필터용.
        # 그룹 회기의 내담자별 미작성을 펼치려면 회기 단위 차집합(find_unlogged_*)이 아니라 완료 회기
        # 전체가 필요(find_unlogged_* 는 노트 1개라도 있으면 회기 통째 제외 → 그룹 부분작성 누락).
        case_repo = self._uow.repo(CounselingCaseRepository)
        case_ids = await ListCaseIdsByCounselorService(case_repo).execute(
            center_id=center_id, counselor_id=counselor_id
        )
        if not case_ids:
            return []

        session_repo = self._uow.repo(CounselingSessionRepository)
        return await ListCompletedSessionsByCaseIdsService(session_repo).execute(
            case_ids
        )

    async def list_unlogged_completed_sessions_by_counselor(
        self,
        center_id: str,
        counselor_id: str,
    ) -> list[CounselingSession]:
        case_repo = self._uow.repo(CounselingCaseRepository)
        case_ids = await ListCaseIdsByCounselorService(case_repo).execute(
            center_id=center_id, counselor_id=counselor_id
        )
        if not case_ids:
            return []

        session_repo = self._uow.repo(CounselingSessionRepository)
        completed = await ListCompletedSessionsByCaseIdsService(session_repo).execute(
            case_ids
        )
        if not completed:
            return []

        note_repo = self._uow.repo(CounselingNoteRepository)
        written = await ListWrittenSessionIdsService(note_repo).execute(
            [s.id for s in completed]
        )

        unlogged = [s for s in completed if s.id not in written]
        unlogged.sort(key=lambda s: s.completed_at or s.created_at, reverse=True)
        return unlogged

    async def get_client_attendance_pattern(
        self,
        center_id: str,
        client_id: str,
        limit: int,
    ) -> list[AttendancePoint]:
        participant_repo = self._uow.repo(CounselingSessionParticipantRepository)
        service = ListAttendancePatternService(participant_repo)
        return await service.execute(
            client_id=client_id, center_id=center_id, limit=limit
        )

    async def aggregate_today_sessions_per_client(
        self,
        center_id: str,
        client_ids: list[str],
        schedule_ids_today: list[str],
        schedule_start_by_id: dict[str, datetime],
    ) -> dict[str, TodaySession]:
        # schedule 의존부(schedule_ids_today, schedule_start_by_id)는 호출자가 ScheduleFacade로 먼저 조회 후 주입
        if not client_ids or not schedule_ids_today:
            return {}

        case_to_client = await self._build_case_to_client_map(center_id, client_ids)
        if not case_to_client:
            return {}

        session_repo = self._uow.repo(CounselingSessionRepository)
        sessions = await ListSessionsByScheduleAndCaseIdsService(session_repo).execute(
            list(case_to_client.keys()), schedule_ids_today
        )
        if not sessions:
            return {}

        result: dict[str, TodaySession] = {}
        for s in sessions:
            start = schedule_start_by_id.get(s.schedule_id)
            if start is None:
                continue
            client_id = case_to_client.get(s.counseling_case_id)
            if not client_id:
                continue
            existing = result.get(client_id)
            if existing is None or start < existing.start:
                result[client_id] = TodaySession(session_id=s.id, start=start)
        return result

    async def aggregate_scheduled_schedule_ids_per_client(
        self,
        center_id: str,
        client_ids: list[str],
    ) -> dict[str, list[str]]:
        # schedule.start(예약 시각)는 이 모듈에서 알 수 없어 schedule_id만 반환 — 호출자(Handler)가 ScheduleFacade로 start 조회
        if not client_ids:
            return {}

        participant_repo = self._uow.repo(CounselingCaseParticipantRepository)
        participants = await ListParticipantsByParticipantIdsService(
            participant_repo
        ).execute(
            participant_ids=client_ids,
            center_id=center_id,
            active_only=True,
            participant_type=CaseParticipantType.CLIENT,
        )
        case_to_clients: dict[str, list[str]] = {}
        for p in participants:
            case_to_clients.setdefault(p.counseling_case_id, []).append(
                p.participant_id
            )
        if not case_to_clients:
            return {}

        from ..counseling_session.services import ListSessionsByCasesService

        session_repo = self._uow.repo(CounselingSessionRepository)
        sessions = await ListSessionsByCasesService(session_repo).execute(
            list(case_to_clients.keys())
        )

        result: dict[str, list[str]] = {}
        for s in sessions:
            if s.status != CounselingSessionStatus.SCHEDULED or not s.schedule_id:
                continue
            for client_id in case_to_clients.get(s.counseling_case_id, []):
                result.setdefault(client_id, []).append(s.schedule_id)
        return result


class CounselingSessionWithParticipants:
    # Assessment의 SessionWithParticipants와 동일한 인터페이스 — duck typing으로 Application Handler에서 동일 처리
    def __init__(
        self,
        session_id: str,
        schedule_id: str,
        case_id: str | None,
        case_code: str | None,
        case_type: str | None,
        session_number: int | None,
        counselor_id: str | None,
        assessment_summary: list[dict],
        client_participants: list[dict],
        status: str | None = None,
        program_id: str | None = None,
        cancel_reason: str | None = None,
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
        self.program_id = program_id
        self.cancel_reason = cancel_reason
