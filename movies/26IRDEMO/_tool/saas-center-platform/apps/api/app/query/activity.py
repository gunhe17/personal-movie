"""query_activity — 센터 활동(감사) 로그 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import datetime

from sqlalchemy import and_, case, func, literal, select, union_all
from sqlalchemy.orm import aliased

from app.application.handlers.activity.labels import (
    ACTION_KO,
    ENTITY_KO,
    ENTITY_TO_CATEGORY,
    SUMMARY_OVERRIDE,
    entity_names_for,
)
from app.core.datetime_utils import parse_datetime
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member.models import Member
from app.modules.event.event.models import Event
from app.modules.event.event_atomic.models import EventAtomic
from app.modules.llm.llm_call.models import LlmCall
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_activity_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — activity는 owner_scope 없이 센터 scope만
    category: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    keyword: str | None = None,  # noqa: ARG001 — summary 키워드 미지원(저장 필드 아님)
    date_from: str | datetime | None = None,
    date_to: str | datetime | None = None,
    actor_id: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "activity_log"
    identity = (
        "id",
        "event_name",
        "summary",
        "created_at",
    )
    opt_in = (
        "category",
        "action",
        "actor_id",
        "actor_name",
        "ip_address",
    )

    dt_from = (
        parse_datetime(date_from)
        if isinstance(date_from, str)
        else date_from
    )
    dt_to = parse_datetime(date_to) if isinstance(date_to, str) else date_to

    entity_names = entity_names_for(category, entity_type)

    category_expr = case(
        *[(EventAtomic.entity_name == key, value) for key, value in ENTITY_TO_CATEGORY.items()],
        else_=EventAtomic.entity_name,
    )
    entity_ko_expr = case(
        *[(EventAtomic.entity_name == key, value) for key, value in ENTITY_KO.items()],
        else_=EventAtomic.entity_name,
    )
    action_ko_expr = case(
        *[(EventAtomic.act == key, value) for key, value in ACTION_KO.items()],
        else_=EventAtomic.act,
    )
    summary_expr = case(
        *[
            (
                and_(EventAtomic.entity_name == ent, EventAtomic.act == act),
                text,
            )
            for (ent, act), text in SUMMARY_OVERRIDE.items()
        ],
        else_=func.concat(entity_ko_expr, literal(" "), action_ko_expr),
    )

    # filters — matching events (any atomic); display uses first non-read atomic
    match_where = [
        Event.center_id == center_id,
        EventAtomic.act != "read",
        EventAtomic.deleted_at.is_(None),
    ]
    if entity_names is not None:
        match_where.append(EventAtomic.entity_name.in_(entity_names))
    if action is not None:
        match_where.append(EventAtomic.act == action)
    if entity_id is not None:
        match_where.append(EventAtomic.entity_id == entity_id)
    if actor_id is not None:
        match_where.append(EventAtomic.actor_id == actor_id)
    if dt_from is not None:
        match_where.append(EventAtomic.created_at >= dt_from)
    if dt_to is not None:
        match_where.append(EventAtomic.created_at <= dt_to)

    matching_event_ids = (
        select(Event.id)
        .select_from(EventAtomic)
        .join(Event, EventAtomic.event_id == Event.id)
        .where(*match_where)
        .distinct()
    )

    first_atomic = (
        select(
            EventAtomic.event_id,
            EventAtomic.act,
            EventAtomic.entity_name,
            EventAtomic.entity_id,
            category_expr.label("category"),
            summary_expr.label("summary"),
            func.row_number()
            .over(
                partition_by=EventAtomic.event_id,
                order_by=EventAtomic.sequence.asc(),
            )
            .label("rn"),
        )
        .where(
            EventAtomic.act != "read",
            EventAtomic.deleted_at.is_(None),
            EventAtomic.event_id.in_(matching_event_ids),
        )
    ).subquery()

    EventMember = aliased(Member)
    EventPerson = aliased(Person)

    events_stmt = (
        select(
            Event.id.label("id"),
            Event.name.label("event_name"),
            first_atomic.c.summary.label("summary"),
            Event.created_at.label("created_at"),
            first_atomic.c.entity_name.label("entity_type"),
            first_atomic.c.entity_id.label("entity_id"),
            first_atomic.c.category.label("category"),
            first_atomic.c.act.label("action"),
            func.coalesce(Event.actor_id, literal("unknown")).label("actor_id"),
            EventPerson.name.label("actor_name"),
            Event.ip_address.label("ip_address"),
        )
        .join(first_atomic, (first_atomic.c.event_id == Event.id) & (first_atomic.c.rn == 1))
        .outerjoin(EventMember, EventMember.id == Event.actor_id)
        .outerjoin(EventPerson, EventPerson.id == EventMember.person_id)
        .where(Event.center_id == center_id)
    )

    include_llm = (
        category in (None, "agent")
        and entity_type in (None, "llm_call")
        and action in (None, "used")
    )

    # scope
    # 센터 공용 조회 — owner_scope 무시

    # project
    if include_llm:
        LlmMember = aliased(Member)
        LlmPerson = aliased(Person)
        llm_where = [
            LlmCall.center_id == center_id,
            LlmCall.deleted_at.is_(None),
        ]
        if actor_id is not None:
            llm_where.append(LlmCall.member_id == actor_id)
        if entity_id is not None:
            llm_where.append(LlmCall.source_id == entity_id)
        if dt_from is not None:
            llm_where.append(LlmCall.created_at >= dt_from)
        if dt_to is not None:
            llm_where.append(LlmCall.created_at <= dt_to)

        llm_stmt = (
            select(
                LlmCall.id.label("id"),
                literal("llm_call_recorded").label("event_name"),
                literal("AI 사용").label("summary"),
                LlmCall.created_at.label("created_at"),
                literal("llm_call").label("entity_type"),
                func.coalesce(LlmCall.source_id, LlmCall.id).label("entity_id"),
                literal("agent").label("category"),
                literal("used").label("action"),
                func.coalesce(LlmCall.member_id, literal("machine")).label("actor_id"),
                LlmPerson.name.label("actor_name"),
                literal(None).label("ip_address"),
            )
            .outerjoin(LlmMember, LlmMember.id == LlmCall.member_id)
            .outerjoin(LlmPerson, LlmPerson.id == LlmMember.person_id)
            .where(*llm_where)
        )
        combined = union_all(events_stmt, llm_stmt).subquery()
        stmt = select(
            combined.c.id,
            combined.c.event_name,
            combined.c.summary,
            combined.c.created_at,
            combined.c.entity_type,
            combined.c.entity_id,
            combined.c.category,
            combined.c.action,
            combined.c.actor_id,
            combined.c.actor_name,
            combined.c.ip_address,
        ).order_by(combined.c.created_at.desc(), combined.c.id)
    else:
        stmt = events_stmt.order_by(Event.created_at.desc(), Event.id)

    # return — limit 없음 → fetch normalize_limit(None)=DEFAULT
    rows, count = await fetch(
        uow.session,
        stmt,
        namespace=namespace if namespaced else None,
        identity=identity,
        fields=fields,
        opt_in=opt_in,
        limit=None,
    )

    return {
        "rows": rows,
        "aggregate": {
            "count": count,
            "exact": True,
        },
    }


TOOL = {
    "name": "query_activity_handler",
    "permission": "read:activity_log",
    "purpose": "센터 활동(감사) 로그를 분류·행위·엔티티·작업자·기간으로 유연 조회한다.",
    "keywords": [
        "query activity",
        "활동 로그",
        "감사 로그",
        "변경 이력",
        "누가 바꿨어",
        "작업 내역",
        "히스토리",
        "audit log",
    ],
    "boundaries": "읽기 전용 활동 로그 유연 조회. 현재 센터 scope의 event 단위 신규 기록과 llm_calls 기반 AI 사용 활동을 조회한다. AI 크레딧 통계는 get_credit_usage_handler, 결제·청구는 billing 도구.",
    "output": "{rows: event 단위 활동 로그 dict 배열 (activity_log.{field}, 대표 atomic 호환 필드 포함), aggregate: {count, exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {"type": "string", "title": "분류 필터"},
            "action": {
                "type": "string",
                "title": "행위 필터",
                "description": "created | updated | deleted | approved | rejected 등",
            },
            "entity_type": {"type": "string", "title": "엔티티 필터"},
            "entity_id": {"type": "string", "format": "uuid", "title": "특정 대상"},
            "keyword": {"type": "string", "title": "키워드 검색"},
            "date_from": {
                "type": "string",
                "format": "date-time",
                "title": "시작 일시",
            },
            "date_to": {"type": "string", "format": "date-time", "title": "종료 일시"},
            "actor_id": {"type": "string", "format": "uuid", "title": "작업자 필터"},
            "fields": {
                "type": "array",
                "items": {"type": "string"},
                "title": "반환 필드",
            },
        },
        "required": [],
    },
}
