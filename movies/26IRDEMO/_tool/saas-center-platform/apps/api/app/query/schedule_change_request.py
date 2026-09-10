"""query_schedule_change_request — 일정 변경 요청 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import literal, or_, select
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.profile.models import Client
from app.modules.schedule.schedule.models import Schedule
from app.modules.schedule.schedule_change_request.models import ScheduleChangeRequest
from app.infrastructure.persistence.agent_query import fetch


async def query_schedule_change_request_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 변경요청은 read:schedule 게이트의 센터 단위 조회
    status: str | None = None,
    schedule_id: str | None = None,
    schedule_ids: list[str] | None = None,
    client_id: str | None = None,
    client_ids: list[str] | None = None,
    person_id: str | None = None,
    person_ids: list[str] | None = None,
    decided_by_member_id: str | None = None,
    decided_by_member_ids: list[str] | None = None,
    requested_start_from: str | date | None = None,
    requested_start_to: str | date | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    keyword: str | None = None,
    id: str | None = None,
    ids: list[str] | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "schedule_change_request"
    # D13 쌍 — schedule_name·client_name의 원천 id는 fields 절삭과 무관하게 동반 (SCR_IDENTITY)
    identity = (
        "id",
        "schedule_id",
        "client_id",
    )
    opt_in = (
        "current_end",
        "requested_end",
        "reason",
        "decision_note",
    )

    sorts = {
        "latest": ScheduleChangeRequest.requested_start.desc(),
        "oldest": ScheduleChangeRequest.requested_start.asc(),
        "requested_start_earliest": ScheduleChangeRequest.requested_start.asc(),
        "requested_start_latest": ScheduleChangeRequest.requested_start.desc(),
    }

    # "MM-DD HH:MM · {title}" — ScheduleFacade.get_schedule_summaries_by_ids 동치
    schedule_name = func.to_char(Schedule.start, "MM-DD HH24:MI").concat(
        func.coalesce(literal(" · ").concat(Schedule.title), "")
    )

    # filters
    where = [
        ScheduleChangeRequest.center_id == center_id,
        ScheduleChangeRequest.deleted_at.is_(None),
    ]

    collected = list(ids or [])
    if id:
        collected.append(id)
    if collected:
        where.append(ScheduleChangeRequest.id.in_(collected))

    if status:
        where.append(ScheduleChangeRequest.status == status)

    sid_set = set(schedule_ids or [])
    if schedule_id:
        sid_set.add(schedule_id)
    if sid_set:
        where.append(ScheduleChangeRequest.schedule_id.in_(sid_set))

    cid_set = set(client_ids or [])
    if client_id:
        cid_set.add(client_id)
    if cid_set:
        where.append(ScheduleChangeRequest.client_id.in_(cid_set))

    pid_set = set(person_ids or [])
    if person_id:
        pid_set.add(person_id)
    if pid_set:
        where.append(ScheduleChangeRequest.person_id.in_(pid_set))

    did_set = set(decided_by_member_ids or [])
    if decided_by_member_id:
        did_set.add(decided_by_member_id)
    if did_set:
        where.append(ScheduleChangeRequest.decided_by_member_id.in_(did_set))

    req_from = coerce_date(requested_start_from, "requested_start_from")
    req_to = coerce_date(requested_start_to, "requested_start_to")
    if req_from:
        where.append(
            ScheduleChangeRequest.requested_start >= datetime.combine(req_from, time.min)
        )
    if req_to:
        where.append(
            ScheduleChangeRequest.requested_start <= datetime.combine(req_to, time.max)
        )

    created_from = coerce_date(date_from, "date_from")
    created_to = coerce_date(date_to, "date_to")
    if created_from:
        where.append(
            ScheduleChangeRequest.created_at >= datetime.combine(created_from, time.min)
        )
    if created_to:
        where.append(
            ScheduleChangeRequest.created_at <= datetime.combine(created_to, time.max)
        )

    if keyword:
        where.append(
            or_(
                ScheduleChangeRequest.reason.ilike(f"%{keyword}%"),
                ScheduleChangeRequest.decision_note.ilike(f"%{keyword}%"),
            )
        )

    # scope
    # 센터 단위 조회 — owner_scope 행 필터 없음

    # project
    stmt = (
        select(
            ScheduleChangeRequest.id,
            ScheduleChangeRequest.schedule_id,
            ScheduleChangeRequest.client_id,
            ScheduleChangeRequest.status,
            ScheduleChangeRequest.current_start,
            ScheduleChangeRequest.current_end,
            ScheduleChangeRequest.requested_start,
            ScheduleChangeRequest.requested_end,
            ScheduleChangeRequest.decided_at,
            ScheduleChangeRequest.reason,
            ScheduleChangeRequest.decision_note,
            schedule_name.label("schedule_name"),
            Client.name.label("client_name"),
        )
        .outerjoin(Schedule, Schedule.id == ScheduleChangeRequest.schedule_id)
        .outerjoin(Client, Client.id == ScheduleChangeRequest.client_id)
        .where(*where)
        .order_by(
            sorts.get(sort or "latest", sorts["latest"]),
            ScheduleChangeRequest.id,
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
    "name": "query_schedule_change_request_handler",
    "permission": "read:schedule",
    "purpose": "일정 변경 요청을 상태·일정·내담자·요청시각으로 유연 조회한다.",
    "keywords": [
        "query schedule change request",
        "일정 변경 요청",
        "변경 요청",
        "리스케줄 요청",
        "일정 변경 승인 대기",
    ],
    "boundaries": "읽기 전용 일정 변경 요청 유연 조회. 내담자 이름은 query_client_handler로 id를 얻어 client_id/client_ids로, 일정은 query_schedule_handler로 id를 얻어 schedule_id/schedule_ids로, 결재자는 query_member_handler로 id를 얻어 decided_by_member_id/decided_by_member_ids로 전달. 요청자(person_id)는 이름으로 찾을 수 없음 — 사람 조건은 client_id로.",
    "output": "{rows: 변경 요청 dict 배열 (fields로 절삭). 정렬: 요청시각 기준. 행에 schedule_name·client_name 동반., aggregate: {count(전체 건수), exact(false면 하한)}}. '몇 건' 질문은 aggregate를 읽는다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "처리 상태",
                "enum": ["pending", "approved", "rejected"],
                "description": "'대기/승인 대기'→pending, '승인'→approved, '반려/거절'→rejected",
            },
            "schedule_id": {
                "type": "string",
                "format": "uuid",
                "title": "일정 필터",
                "description": "일정은 query_schedule_handler로 id 확인 후 넘긴다.",
            },
            "schedule_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "일정 필터 복수",
            },
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "내담자 필터",
                "description": "이름은 query_client_handler로 id 확인 후 넘긴다.",
            },
            "client_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "내담자 필터 복수",
            },
            "person_id": {
                "type": "string",
                "format": "uuid",
                "title": "요청자 필터",
                "description": "변경을 요청한 보호자의 person id. 이름→person id 조회 도구는 없다 — 이미 아는 id만 넘긴다. 사람으로 좁히려면 client_id를 쓴다.",
            },
            "person_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "요청자 필터 복수",
            },
            "decided_by_member_id": {
                "type": "string",
                "format": "uuid",
                "title": "결재자 필터",
                "description": "승인·반려를 처리한 멤버. 이름은 query_member_handler로 id 확인 후 넘긴다.",
            },
            "decided_by_member_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "결재자 필터 복수",
            },
            "requested_start_from": {
                "type": "string",
                "format": "date",
                "title": "요청 변경시각 시작",
            },
            "requested_start_to": {
                "type": "string",
                "format": "date",
                "title": "요청 변경시각 종료",
            },
            "date_from": {"type": "string", "format": "date", "title": "요청 등록일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "요청 등록일 종료"},
            "keyword": {
                "type": "string",
                "title": "키워드",
                "description": "사유·결정 메모 검색",
            },
            "id": {"type": "string", "format": "uuid", "title": "변경 요청 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "변경 요청 ID 복수",
            },
            "sort": {
                "type": "string",
                "enum": [
                    "latest",
                    "oldest",
                    "requested_start_earliest",
                    "requested_start_latest",
                ],
                "title": "정렬",
                "description": "'최신순'→latest(요청 변경시각 기준, 기본), '오래된 순'→oldest, '요청 이른순'→requested_start_earliest, '요청 늦은순'→requested_start_latest",
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
