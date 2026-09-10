from datetime import datetime
from math import ceil

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import AuditEvent, query_audit
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade
from app.modules.llm.facade import LlmCallFacade
from app.modules.llm.llm_call.schemas import LlmCallRecord

from .labels import category_of, summary_of, entity_names_for
from .schemas import ActivityChange, ActivityLogResponse, ActivityLogListResponse


async def list_activity_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    category: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    size: int = 20,
) -> ActivityLogListResponse:
    fetch_size = page * size
    # load (fact)
    events, page_meta = await query_audit(
        uow,
        center_id=center_id,
        entity_names=entity_names_for(category, entity_type),
        act=action,
        entity_id=entity_id,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        page=1,
        size=fetch_size,
    )
    include_llm = (
        category in (None, "agent")
        and entity_type in (None, "llm_call")
        and action in (None, "used")
    )
    llm_calls, llm_total = (
        await LlmCallFacade(uow).list_activity(
            center_id,
            member_id=actor_id,
            source_id=entity_id,
            date_from=date_from,
            date_to=date_to,
            limit=fetch_size,
        )
        if include_llm
        else ([], 0)
    )

    # enrich (actor_name — 크로스모듈 일괄)
    names = await _resolve_actor_names(
        uow,
        [
            *(event.actor_id for event in events),
            *(call.member_id for call in llm_calls),
        ],
    )

    # present
    items = [
        _to_response(event, actor_name=names.get(event.actor_id)) for event in events
    ]
    items.extend(
        _llm_to_response(
            call, center_id=center_id, actor_name=names.get(call.member_id)
        )
        for call in llm_calls
    )
    items.sort(key=lambda item: item.created_at, reverse=True)
    total = page_meta["total"] + llm_total
    start = (page - 1) * size
    return ActivityLogListResponse(
        items=items[start : start + size],
        total=total,
        page=page,
        size=size,
        pages=ceil(total / size) if size else 0,
    )


async def _resolve_actor_names(
    uow: UnitOfWork,
    actor_ids: list[str | None],
) -> dict[str, str | None]:
    member_ids = list({actor_id for actor_id in actor_ids if actor_id})
    if not member_ids:
        return {}

    members = await MemberFacade(uow).get_members_by_ids(member_ids)
    persons = await PersonFacade(uow).get_persons_by_ids(
        [m.person_id for m in members.values()]
    )
    return {
        member_id: (
            persons[member.person_id].name if member.person_id in persons else None
        )
        for member_id, member in members.items()
    }


def _llm_to_response(
    call: LlmCallRecord,
    *,
    center_id: str,
    actor_name: str | None,
) -> ActivityLogResponse:
    payload = {
        "purpose": call.purpose,
        "model": call.model,
        "input_tokens": call.input_tokens,
        "output_tokens": call.output_tokens,
        "credits_charged": call.credits_charged,
        "error_message": call.error_message,
    }
    change = ActivityChange(
        id=call.id,
        action="used",
        entity_type="llm_call",
        entity_id=call.source_id or call.id,
        summary="AI 사용",
        extra=payload,
    )
    return ActivityLogResponse(
        id=call.id,
        event_name="llm_call_recorded",
        center_id=center_id,
        actor_id=call.member_id or "machine",
        actor_name=actor_name,
        category="agent",
        action=change.action,
        entity_type=change.entity_type,
        entity_id=change.entity_id,
        summary=change.summary,
        ip_address=None,
        user_agent=None,
        extra=payload,
        changes=[change],
        created_at=call.created_at,
    )


def _to_response(
    event: AuditEvent,
    *,
    actor_name: str | None,
) -> ActivityLogResponse:
    atomic = event.atomics[0]
    return ActivityLogResponse(
        id=event.id,
        event_name=event.name,
        center_id=event.center_id,
        actor_id=event.actor_id or "unknown",
        actor_name=actor_name,
        category=category_of(atomic.entity_name),
        action=atomic.act,
        entity_type=atomic.entity_name,
        entity_id=atomic.entity_id,
        summary=summary_of(atomic.entity_name, atomic.act),
        ip_address=event.ip_address,
        user_agent=None,
        extra=atomic.payload or None,
        changes=[
            ActivityChange(
                id=change.id,
                action=change.act,
                entity_type=change.entity_name,
                entity_id=change.entity_id,
                summary=summary_of(change.entity_name, change.act),
                extra=change.payload or None,
            )
            for change in event.atomics
        ],
        created_at=event.created_at,
    )


TOOL = {
    "name": "list_activity_handler",
    "agent_exposed": False,
    "permission": "read:activity_log",
    "purpose": "센터 안에서 누가 무엇을 생성·수정·삭제했는지 활동(감사) 로그를 시간순으로 조회한다.",
    "keywords": [
        "list activity",
        "활동 로그",
        "감사 로그",
        "변경 이력",
        "누가 바꿨어",
        "작업 내역",
        "히스토리",
        "감사 추적",
        "활동 내역",
        "audit log",
    ],
    "boundaries": "센터 구성원이 남긴 사건 기록을 필터링해 보는 읽기 전용 도구다. 목록 한 건은 event이고 changes에 원자 변경 내역이 담긴다. AI 호출 활동은 별도 child event 없이 llm_calls 정본을 같은 목록에 병합한다. AI 크레딧 집계는 get_credit_usage_handler를, 결제·청구 내역은 billing 도구를 쓴다. 현재 센터 기준 신규 events/llm_calls만 보이며 과거 activity_logs 행은 제외한다.",
    "output": "활동(감사) 로그 목록, 페이지 메타 포함 (ActivityLogListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "title": "분류 필터",
                "description": "활동을 묶는 상위 분류 (예: client=내담자, counseling=상담, assessment=검사, billing=결제, document=문서, member=구성원). 생략하면 전체.",
            },
            "action": {
                "type": "string",
                "title": "행위 필터",
                "description": "수행한 행위 종류 (예: created=생성, updated=수정, deleted=삭제, approved=승인, rejected=반려). 생략하면 전체.",
            },
            "entity_type": {
                "type": "string",
                "title": "엔티티 필터",
                "description": "대상 객체의 종류 (예: client, counseling_session, document, member). category보다 더 좁게 특정 엔티티만 본다.",
            },
            "entity_id": {
                "type": "string",
                "format": "uuid",
                "title": "특정 대상",
                "description": "이력을 추적할 특정 대상 한 건의 UUID. 그 객체에 일어난 변경만 본다.",
            },
            "actor_id": {
                "type": "string",
                "format": "uuid",
                "title": "작업자 필터",
                "description": "이 활동을 한 구성원(작업자)의 UUID. 특정 직원이 한 일만 추릴 때 쓴다.",
            },
            "date_from": {
                "type": "string",
                "format": "date-time",
                "title": "시작 일시",
                "description": "조회 시작 일시 (이 시각 이후의 활동만).",
            },
            "date_to": {
                "type": "string",
                "format": "date-time",
                "title": "종료 일시",
                "description": "조회 종료 일시 (이 시각 이전의 활동만).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호 (1부터 시작).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "한 페이지에 담을 활동 건수 (기본 20).",
            },
        },
        "required": [],
    },
}
