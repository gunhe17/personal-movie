"""query_assessment_session — 검사 회기 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import literal, null, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment_case.models import AssessmentCase
from app.modules.assessment.assessment_case_participant.models import (
    AssessmentCaseParticipant,
)
from app.modules.assessment.assessment_session.models import AssessmentSession
from app.modules.client.profile.models import Client
from app.modules.schedule.schedule.models import Schedule
from app.infrastructure.persistence.agent_query import fetch


async def query_assessment_session_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,
    status: str | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    case_id: str | None = None,
    case_ids: list[str] | None = None,
    client_id: str | None = None,
    client_ids: list[str] | None = None,
    schedule_id: str | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "assessment_session"
    # D13 쌍 — schedule_name→schedule_id, client_names→case_id
    identity = (
        "id",
        "session_number",
        "schedule_id",
        "case_id",
    )
    opt_in = (
        "cancel_reason",
        "center_id",
    )
    sorts = {
        "latest": AssessmentSession.created_at.desc(),
        "oldest": AssessmentSession.created_at.asc(),
    }

    def accessible_case_ids(member_id: str):
        """열람 범위 = 주담당 + **활성** 참여 검사자 — AssessmentCaseFacade.list_accessible_case_ids."""
        AssistantParticipant = aliased(AssessmentCaseParticipant)
        return (
            select(AssessmentCase.id)
            .where(
                AssessmentCase.center_id == center_id,
                AssessmentCase.counselor_id == member_id,
                AssessmentCase.deleted_at.is_(None),
            )
            .union(
                select(AssistantParticipant.case_id).where(
                    AssistantParticipant.center_id == center_id,
                    AssistantParticipant.participant_id == member_id,
                    AssistantParticipant.participant_type == "assistant",
                    # list_case_ids_by_assistant 동치 — unassigned 미필터(과거 참여 포함)
                    AssistantParticipant.deleted_at.is_(None),
                )
            )
        )

    # filters
    where = [
        AssessmentSession.center_id == center_id,
        AssessmentSession.deleted_at.is_(None),
    ]

    if status:
        where.append(AssessmentSession.status == status)
    if schedule_id:
        where.append(AssessmentSession.schedule_id == schedule_id)

    all_case_ids = [*(case_ids or []), *([case_id] if case_id else [])]
    if all_case_ids:
        where.append(AssessmentSession.case_id.in_(all_case_ids))

    # 기간은 연결 일정의 start — 구 구현은 schedule_ids를 선조회해 절삭-선행 버그가 있었다
    if date_from:
        where.append(Schedule.start >= coerce_date(date_from, "date_from"))
    if date_to:
        where.append(Schedule.start <= datetime.combine(coerce_date(date_to, "date_to"), time.max))

    # 내담자 참여 케이스 역산 — 파이썬 id 목록 금지
    all_client_ids = [*(client_ids or []), *([client_id] if client_id else [])]
    if all_client_ids:
        ClientParticipant = aliased(AssessmentCaseParticipant)
        where.append(
            AssessmentSession.case_id.in_(
                select(ClientParticipant.case_id).where(
                    ClientParticipant.center_id == center_id,
                    ClientParticipant.participant_id.in_(all_client_ids),
                    ClientParticipant.participant_type == "client",
                    ClientParticipant.unassigned_at.is_(None),
                    ClientParticipant.deleted_at.is_(None),
                )
            )
        )

    # scope
    if owner_scope is not None:
        where.append(AssessmentSession.case_id.in_(accessible_case_ids(owner_scope)))

    # project
    # "MM-DD HH:MM · {title}" — ScheduleFacade.get_schedule_summaries_by_ids 동치
    schedule_name = func.to_char(Schedule.start, "MM-DD HH24:MI").concat(
        func.coalesce(literal(" · ").concat(Schedule.title), "")
    )

    stmt = (
        select(
            AssessmentSession.id,
            null().label("session_number"),  # 모델에 컬럼 없음 — 구 getattr=None 동치
            AssessmentSession.status,
            AssessmentSession.cancel_reason,
            AssessmentSession.center_id,
            AssessmentSession.case_id,
            AssessmentSession.schedule_id,
            AssessmentCase.case_code.label("case_code"),
            schedule_name.label("schedule_name"),
            func.array_remove(
                func.array_agg(aggregate_order_by(Client.name, Client.id)), None
            ).label("client_names"),
        )
        .join(AssessmentCase, AssessmentCase.id == AssessmentSession.case_id)
        .outerjoin(Schedule, Schedule.id == AssessmentSession.schedule_id)
        .outerjoin(
            AssessmentCaseParticipant,
            (AssessmentCaseParticipant.case_id == AssessmentSession.case_id)
            & (AssessmentCaseParticipant.participant_type == "client")
            & AssessmentCaseParticipant.unassigned_at.is_(None)
            & AssessmentCaseParticipant.deleted_at.is_(None),
        )
        .outerjoin(Client, Client.id == AssessmentCaseParticipant.participant_id)
        .where(*where)
        .group_by(
            AssessmentSession.id,
            AssessmentCase.case_code,
            Schedule.start,
            Schedule.title,
        )
        .order_by(
            sorts.get(sort or "latest", sorts["latest"]),
            AssessmentSession.id,
        )
    )

    # return
    rows, count = await fetch(
        uow.session,
        stmt,
        namespace=namespace if namespaced else None,
        identity=identity,
        fields=fields,
        opt_in=opt_in,
        limit=limit,
    )

    return {
        "rows": rows,
        "aggregate": {
            "count": count,
            "exact": True,
        },
    }


TOOL = {
    "name": "query_assessment_session_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 회기(실시 일자·시간)를 상태·기간으로 유연 조회한다.",
    "keywords": [
        "query assessment session",
        "검사 일정",
        "검사 회기",
        "이번달 검사",
        "예정된 검사",
    ],
    "boundaries": "'이번달/오늘 검사' 같은 기간 질의는 여기. 검사 종류는 query_assessment_handler, 케이스 코드(AC0001)는 query_assessment_case_handler로 id 확인 후 case_id로.",
    "output": "{rows: 검사 회기 dict 배열 (fields로 절삭). 기본 정렬: created_at 최신순. 행에 case_code·schedule_name·client_names(수검 내담자 이름 목록) 동반., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태",
                "enum": ["scheduled", "completed", "cancelled", "no_show"],
            },
            "date_from": {"type": "string", "format": "date", "title": "기간 시작일"},
            "date_to": {"type": "string", "format": "date", "title": "기간 종료일"},
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "검사 케이스 UUID",
            },
            "case_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "검사 케이스 UUID 목록",
            },
            "client_id": {
                "type": "string",
                "title": "내담자 id",
                "description": "이 내담자가 참여한 건으로 필터. 이름은 query_client로 id 확인 후 넘긴다.",
            },
            "client_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "내담자 id 목록",
                "description": "여러 내담자 참여 건 필터.",
            },
            "schedule_id": {"type": "string", "format": "uuid", "title": "일정 UUID"},
            "sort": {
                "type": "string",
                "enum": ["latest", "oldest"],
                "title": "정렬",
                "description": "'최신순/마지막'→latest(기본), '오래된 순'→oldest",
            },
            "limit": {"type": "integer", "title": "최대 개수"},
            "fields": {
                "type": "array",
                "items": {"type": "string"},
                "title": "반환 필드",
            },
        },
        "required": [],
    },
}
