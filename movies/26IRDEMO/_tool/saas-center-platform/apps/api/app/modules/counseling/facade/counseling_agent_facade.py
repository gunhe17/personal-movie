from datetime import date

from app.infrastructure.persistence.agent_query import merge_fields, to_dicts
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..counseling_case.repository import CounselingCaseRepository
from ..counseling_case.services.list_counseling_cases_by_agent_filters import (
    ListCounselingCasesByAgentFiltersService,
)

from ..counseling_session.repository import CounselingSessionRepository
from ..counseling_session.services.list_counseling_sessions_by_agent_filters import (
    ListCounselingSessionsByAgentFiltersService,
)


from ..counseling_case_participant.repository import CounselingCaseParticipantRepository
from ..counseling_case_participant.services.list_participants_by_agent_filters import (
    ListParticipantsByAgentFiltersService,
)


# 크로스모듈 이름(counselor_name·program_name·client_names·schedule_name·client_name·
# author_name·participant_name)은 query handler 본문이 인라인 조립 — 여기는 자기 모듈
# 해소(case_code·counseling_session_name)만.
CASE_IDENTITY_FIELDS = ["id", "case_code"]
CASE_DEFAULT_FIELDS = [
    "id", "case_code",
    "counselor_id", "program_id",
    "status", "total_sessions",
]
CASE_AVAILABLE_FIELDS = {
    "case_code", "status",
    "chief_complaint", "memo", "total_sessions",
    "id", "counselor_id", "program_id",
}
CASE_NAMESPACE = "case"

SESSION_IDENTITY_FIELDS = ["id", "session_number"]
SESSION_DEFAULT_FIELDS = [
    "id", "session_number",
    "counseling_case_id", "case_code",
    "schedule_id", "status", "completed_at",
]
SESSION_AVAILABLE_FIELDS = {
    "session_number", "status", "cancel_reason", "completed_at",
    "case_code",
    "id", "counseling_case_id", "schedule_id",
}
SESSION_NAMESPACE = "session"

NOTE_IDENTITY_FIELDS = ["id", "summary", "created_at"]
NOTE_DEFAULT_FIELDS = [
    "id", "summary", "created_at",
    "counseling_session_id", "counseling_session_name",
    "client_id",
    "author_id",
]
NOTE_AVAILABLE_FIELDS = {
    "summary", "content", "created_at",
    "counseling_session_name",
    "id", "counseling_session_id", "client_id", "author_id",
}
NOTE_NAMESPACE = "note"

PARTICIPANT_IDENTITY_FIELDS = ["id", "participant_id"]
PARTICIPANT_DEFAULT_FIELDS = [
    "id", "participant_id",
    "counseling_case_id", "case_code",
]
PARTICIPANT_AVAILABLE_FIELDS = {
    "participant_type", "is_active", "joined_at", "left_at",
    "case_code",
    "id", "counseling_case_id", "participant_id",
}
PARTICIPANT_NAMESPACE = "participant"


class CounselingAgentFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def resolve_agent_ref(
        self, center_id: str, field: str, value: str
    ) -> list[dict]:
        rows, _ = await self.query_case(center_id, case_code=value)
        return rows

    async def query_case(
        self,
        center_id: str,
        *,
        case_code: str | None = None,
        status: str | None = None,
        keyword: str | None = None,
        total_sessions_min: int | None = None,
        total_sessions_max: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        sort: str = "desc",
        id: str | None = None,
        program_id: str | None = None,
        counselor_id: str | None = None,
        client_id: str | None = None,
        ids: list[str] | None = None,
        program_ids: list[str] | None = None,
        counselor_ids: list[str] | None = None,
        client_ids: list[str] | None = None,
        limit: int | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        from app.infrastructure.persistence.agent_query import normalize_limit

        collected_ids = list(ids or [])
        if id:
            collected_ids.append(id)
        collected_program_ids = list(program_ids or [])
        if program_id:
            collected_program_ids.append(program_id)
        collected_counselor_ids = list(counselor_ids or [])
        if counselor_id:
            collected_counselor_ids.append(counselor_id)

        collected_client_ids = list(client_ids or [])
        if client_id:
            collected_client_ids.append(client_id)
        if collected_client_ids:
            # 내담자 참여 케이스를 participant로 역산 → ids 교집합/대입
            parts, _ = await self.query_participant(
                center_id,
                participant_ids=collected_client_ids,
                participant_type="client",
                fields=["counseling_case_id"],
            )
            client_case_ids = [
                p.get("participant.counseling_case_id")
                for p in parts
                if p.get("participant.counseling_case_id")
            ]
            if not client_case_ids:
                return [], 0
            if collected_ids:
                allowed = set(client_case_ids)
                collected_ids = [i for i in collected_ids if i in allowed]
                if not collected_ids:
                    return [], 0
            else:
                collected_ids = client_case_ids

        service = ListCounselingCasesByAgentFiltersService(
            self._uow.repo(CounselingCaseRepository)
        )
        cases, total = await service.execute(
            center_id,
            sort=sort,
            limit=normalize_limit(limit),
            case_code=case_code,
            status=status,
            keyword=keyword,
            total_sessions_min=total_sessions_min,
            total_sessions_max=total_sessions_max,
            date_from=date_from,
            date_to=date_to,
            program_ids=collected_program_ids or None,
            counselor_ids=collected_counselor_ids or None,
            ids=collected_ids or None,
        )

        merged_fields = _merge_fields(fields, CASE_DEFAULT_FIELDS, CASE_AVAILABLE_FIELDS, identity_fields=CASE_IDENTITY_FIELDS)

        return to_dicts(cases, merged_fields, CASE_NAMESPACE if namespaced else ""), total

    async def query_session(
        self,
        center_id: str,
        *,
        status: str | None = None,
        session_number_min: int | None = None,
        session_number_max: int | None = None,
        id: str | None = None,
        counseling_case_id: str | None = None,
        client_id: str | None = None,
        schedule_id: str | None = None,
        ids: list[str] | None = None,
        counseling_case_ids: list[str] | None = None,
        schedule_ids: list[str] | None = None,
        completed_from: date | None = None,
        completed_to: date | None = None,
        sort: str = "desc",
        limit: int | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        from app.infrastructure.persistence.agent_query import normalize_limit

        collected_case_ids = list(counseling_case_ids or [])
        if counseling_case_id:
            collected_case_ids.append(counseling_case_id)

        if client_id:
            # J2 조인: 내담자 참여 케이스를 participant로 역산해 case_ids에 합류 (스레딩 제거)
            parts, _ = await self.query_participant(
                center_id, participant_ids=[client_id],
                participant_type="client", fields=["counseling_case_id"],
            )
            client_case_ids = [p.get("participant.counseling_case_id") for p in parts
                               if p.get("participant.counseling_case_id")]
            if not client_case_ids:
                return [], 0
            collected_case_ids.extend(client_case_ids)

        collected_ids = list(ids or [])
        if id:
            collected_ids.append(id)
        collected_schedule_ids = list(schedule_ids or [])
        if schedule_id:
            collected_schedule_ids.append(schedule_id)

        service = ListCounselingSessionsByAgentFiltersService(
            self._uow.repo(CounselingSessionRepository)
        )
        sessions, total = await service.execute(
            center_id,
            sort=sort,
            limit=normalize_limit(limit),
            status=status,
            session_number_min=session_number_min,
            session_number_max=session_number_max,
            completed_from=completed_from,
            completed_to=completed_to,
            case_ids=collected_case_ids or None,
            schedule_ids=collected_schedule_ids or None,
            ids=collected_ids or None,
        )

        merged_fields = _merge_fields(fields, SESSION_DEFAULT_FIELDS, SESSION_AVAILABLE_FIELDS, identity_fields=SESSION_IDENTITY_FIELDS)

        case_code_map: dict[str, str] = {}
        if "case_code" in merged_fields:
            case_code_map = await self._resolve_case_codes(
                list({s.counseling_case_id for s in sessions if s.counseling_case_id})
            )

        rows = to_dicts(
            sessions,
            merged_fields,
            SESSION_NAMESPACE if namespaced else "",
            resolvers={
                "case_code": lambda e: case_code_map.get(e.counseling_case_id, None),
            },
        )
        return rows, total

    async def query_participant(
        self,
        center_id: str,
        *,
        participant_type: str | None = None,
        active_only: bool = True,
        counseling_case_id: str | None = None,
        participant_id: str | None = None,
        counseling_case_ids: list[str] | None = None,
        participant_ids: list[str] | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        collected_case_ids = list(counseling_case_ids or [])
        if counseling_case_id:
            collected_case_ids.append(counseling_case_id)
        collected_participant_ids = list(participant_ids or [])
        if participant_id:
            collected_participant_ids.append(participant_id)

        service = ListParticipantsByAgentFiltersService(
            self._uow.repo(CounselingCaseParticipantRepository)
        )
        participants, total = await service.execute(
            center_id,
            limit=200,
            participant_type=participant_type,
            active_only=active_only,
            case_ids=collected_case_ids or None,
            participant_ids=collected_participant_ids or None,
        )

        merged_fields = _merge_fields(
            fields, PARTICIPANT_DEFAULT_FIELDS, PARTICIPANT_AVAILABLE_FIELDS,
            identity_fields=PARTICIPANT_IDENTITY_FIELDS,
        )

        case_code_map: dict[str, str] = {}
        if "case_code" in merged_fields:
            case_code_map = await self._resolve_case_codes(
                list({p.counseling_case_id for p in participants if p.counseling_case_id})
            )

        rows = to_dicts(
            participants,
            merged_fields,
            PARTICIPANT_NAMESPACE if namespaced else "",
            resolvers={
                "case_code": lambda e: case_code_map.get(e.counseling_case_id, None),
            },
        )
        return rows, total

    async def _resolve_case_codes(
        self, case_ids: list[str]
    ) -> dict[str, str]:
        from .counseling_case_facade import CounselingCaseFacade

        return await CounselingCaseFacade(self._uow).get_counseling_case_summaries_by_ids(case_ids)

    async def _resolve_session_names(
        self, session_ids: list[str], center_id: str
    ) -> dict[str, str]:
        if not session_ids:
            return {}

        from .counseling_session_facade import CounselingSessionFacade

        sessions = await CounselingSessionFacade(self._uow).get_sessions_by_ids(
            session_ids=session_ids,
            center_id=center_id,
        )
        case_code_map = await self._resolve_case_codes(
            list({s.counseling_case_id for s in sessions if s.counseling_case_id})
        )

        name_map: dict[str, str] = {}
        for s in sessions:
            parts = []
            case_code = case_code_map.get(s.counseling_case_id)
            if case_code:
                parts.append(case_code)
            if s.session_number:
                parts.append(f"{s.session_number}회기")
            if parts:
                name_map[s.id] = " · ".join(parts)
        return name_map


def _merge_fields(
    fields: list[str] | None,
    default_fields: list[str],
    available_fields: set[str],
    *,
    identity_fields: list[str] | None = None,
) -> list[str]:
    return merge_fields(fields, default_fields, available_fields, identity=identity_fields)

