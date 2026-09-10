from datetime import date

from app.infrastructure.persistence.agent_query import merge_fields, to_dicts
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..assessment_case.repository import AssessmentCaseRepository
from ..assessment_case.services.list_assessment_cases_by_agent_filters import (
    ListAssessmentCasesByAgentFiltersService,
)
from ..assessment_session.repository import AssessmentSessionRepository
from ..assessment_session.services.list_assessment_sessions_by_agent_filters import (
    ListAssessmentSessionsByAgentFiltersService,
)
from ..assessment_case_participant.repository import AssessmentCaseParticipantRepository
from ..assessment_case_participant.services.list_participants_by_agent_filters import (
    ListAssessmentParticipantsByAgentFiltersService,
)


_NS_ASSESSMENT = "assessment"
_NS_CASE = "assessment_case"
_NS_SESSION = "assessment_session"
_NS_PARTICIPANT = "assessment_participant"
_NS_SET = "assessment_set"

# 크로스모듈 이름(schedule_name·participant_name·client_names)은 query handler 본문이 인라인
# 조립 — 여기는 자기 모듈 해소(case_code)와 denorm 컬럼(client_name·counselor_name)만.
_IDENTITY = {
    _NS_ASSESSMENT: ["id", "name"],
    _NS_CASE: ["id", "case_code"],
    _NS_SESSION: ["id", "session_number"],
    _NS_PARTICIPANT: ["id", "participant_id"],
    _NS_SET: ["id", "name"],
}

_DEFAULTS = {
    _NS_ASSESSMENT: ["id", "name", "code", "assessment_type", "workflow_type", "status", "supports_online"],
    # 페이지 /assessment/status parity — fields 미지정 시 자동 포함
    _NS_CASE: [
        "id", "case_code",
        "client_name", "counselor_name",
        "assessment_summary", "set_summary",
        "status", "tags", "registered_at", "is_final_report_required",
    ],
    _NS_SESSION: [
        "id", "session_number",
        "case_id", "case_code",
        "schedule_id", "status",
    ],
    _NS_PARTICIPANT: [
        "id", "participant_id",
        "case_id", "case_code",
    ],
    _NS_SET: ["id", "name"],
}

_AVAILABLE = {
    _NS_ASSESSMENT: {
        "name", "assessment_type", "workflow_type", "code", "kor_name",
        "eng_name", "description", "duration", "status",
        "supports_online",
        "id",
    },
    _NS_CASE: {
        "case_code", "status", "tags", "is_final_report_required",
        "assessment_summary", "set_summary", "institution_summary",
        "client_name", "counselor_name", "registered_at",  # denorm
        "id", "center_id", "counselor_id",
    },
    _NS_SESSION: {
        "session_number", "status", "cancel_reason",
        "case_code",
        "id", "center_id", "case_id", "schedule_id",
    },
    _NS_PARTICIPANT: {
        "participant_type", "case_code",
        "id", "case_id", "participant_id",
    },
    _NS_SET: {
        "name", "description", "assessment_summary", "center_member_summary",
        "id", "center_id",
    },
}


class AssessmentAgentFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def resolve_agent_ref(
        self, center_id: str, field: str, value: str
    ) -> list[dict]:
        return await self.query_case(center_id, case_code=value)

    async def query_case(
        self,
        center_id: str,
        *,
        case_code: str | None = None,
        status: str | None = None,
        tags: list[str] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        id: str | None = None,
        counselor_id: str | None = None,
        client_id: str | None = None,
        ids: list[str] | None = None,
        counselor_ids: list[str] | None = None,
        client_ids: list[str] | None = None,
        completed_from: date | None = None,
        completed_to: date | None = None,
        is_final_report_required: bool | None = None,
        sort: str = "desc",
        limit: int | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        from app.infrastructure.persistence.agent_query import normalize_limit

        collected_ids = list(ids or [])
        if id:
            collected_ids.append(id)
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
                fields=["case_id"],
            )
            client_case_ids = [
                p.get("assessment_participant.case_id")
                for p in parts
                if p.get("assessment_participant.case_id")
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

        service = ListAssessmentCasesByAgentFiltersService(
            self._uow.repo(AssessmentCaseRepository)
        )
        cases, total = await service.execute(
            center_id,
            sort=sort,
            limit=normalize_limit(limit),
            case_code=case_code,
            status=status,
            tags=tags,
            date_from=date_from,
            date_to=date_to,
            counselor_ids=collected_counselor_ids or None,
            completed_from=completed_from,
            completed_to=completed_to,
            is_final_report_required=is_final_report_required,
            ids=collected_ids or None,
        )

        merged = _merge_fields(fields, _NS_CASE)
        return to_dicts(cases, merged, _NS_CASE if namespaced else ""), total

    async def query_session(
        self,
        center_id: str,
        *,
        status: str | None = None,
        id: str | None = None,
        case_id: str | None = None,
        client_id: str | None = None,
        schedule_id: str | None = None,
        ids: list[str] | None = None,
        case_ids: list[str] | None = None,
        client_ids: list[str] | None = None,
        schedule_ids: list[str] | None = None,
        sort: str = "desc",
        limit: int | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        from app.infrastructure.persistence.agent_query import normalize_limit

        collected_ids = list(ids or [])
        if id:
            collected_ids.append(id)
        collected_case_ids = list(case_ids or [])
        if case_id:
            collected_case_ids.append(case_id)

        collected_client_ids = list(client_ids or [])
        if client_id:
            collected_client_ids.append(client_id)
        if collected_client_ids:
            # 내담자 참여 케이스를 participant로 역산해 case_ids에 합류 (counseling query_session과 동일)
            parts, _ = await self.query_participant(
                center_id,
                participant_ids=collected_client_ids,
                participant_type="client",
                fields=["case_id"],
            )
            client_case_ids = [
                p.get("assessment_participant.case_id")
                for p in parts
                if p.get("assessment_participant.case_id")
            ]
            if not client_case_ids:
                return [], 0
            collected_case_ids.extend(client_case_ids)

        collected_schedule_ids = list(schedule_ids or [])
        if schedule_id:
            collected_schedule_ids.append(schedule_id)

        service = ListAssessmentSessionsByAgentFiltersService(
            self._uow.repo(AssessmentSessionRepository)
        )
        sessions, total = await service.execute(
            center_id,
            sort=sort,
            limit=normalize_limit(limit),
            status=status,
            case_ids=collected_case_ids or None,
            schedule_ids=collected_schedule_ids or None,
            ids=collected_ids or None,
        )

        merged = _merge_fields(fields, _NS_SESSION)

        case_code_map: dict[str, str] = {}
        if "case_code" in merged:
            case_code_map = await self._resolve_case_codes(
                list({s.case_id for s in sessions if s.case_id})
            )

        rows = to_dicts(
            sessions,
            merged,
            _NS_SESSION if namespaced else "",
            resolvers={
                "case_code": lambda e: case_code_map.get(e.case_id, None),
            },
        )
        return rows, total

    async def query_participant(
        self,
        center_id: str,
        *,
        participant_type: str | None = None,
        case_id: str | None = None,
        participant_id: str | None = None,
        case_ids: list[str] | None = None,
        participant_ids: list[str] | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        collected_case_ids = list(case_ids or [])
        if case_id:
            collected_case_ids.append(case_id)
        collected_participant_ids = list(participant_ids or [])
        if participant_id:
            collected_participant_ids.append(participant_id)

        service = ListAssessmentParticipantsByAgentFiltersService(
            self._uow.repo(AssessmentCaseParticipantRepository)
        )
        participants, total = await service.execute(
            center_id,
            limit=200,
            participant_type=participant_type,
            case_ids=collected_case_ids or None,
            participant_ids=collected_participant_ids or None,
        )

        merged = _merge_fields(fields, _NS_PARTICIPANT)

        case_code_map: dict[str, str] = {}
        if "case_code" in merged:
            case_code_map = await self._resolve_case_codes(
                list({p.case_id for p in participants if p.case_id})
            )

        rows = to_dicts(
            participants,
            merged,
            _NS_PARTICIPANT if namespaced else "",
            resolvers={
                "case_code": lambda e: case_code_map.get(e.case_id, None),
            },
        )
        return rows, total

    async def _resolve_case_codes(self, case_ids: list[str]) -> dict[str, str]:
        from .assessment_case_facade import AssessmentCaseFacade

        return await AssessmentCaseFacade(self._uow).get_assessment_case_summaries_by_ids(
            case_ids=case_ids,
        )

def _merge_fields(fields: list[str] | None, namespace: str) -> list[str]:
    return merge_fields(
        fields, _DEFAULTS[namespace], _AVAILABLE[namespace], identity=_IDENTITY[namespace],
    )

