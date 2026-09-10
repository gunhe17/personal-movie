"""query_room — 상담실 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import or_, select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.room.models import Room
from app.infrastructure.persistence.agent_query import fetch


async def query_room_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 센터 공용 자원, 행 필터 없음
    name: str | None = None,
    is_active: bool | None = None,
    keyword: str | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "room"
    identity = (
        "id",
        "name",
    )
    opt_in = (  # select엔 있으나 기본 출력에선 빠짐 — fields로만
        "is_active",
        "description",
        "memo",
        "thumbnail_url",
        "inactive_reason",
    )
    sorts = {
        "latest": Room.created_at.desc(),
        "oldest": Room.created_at.asc(),
    }

    # filters
    where = [
        Room.center_id == center_id,
        Room.deleted_at.is_(None),
    ]

    if name:
        where.append(Room.name.ilike(f"%{name}%"))
    if is_active is not None:
        where.append(Room.is_active.is_(is_active))
    if keyword:
        where.append(
            or_(
                Room.description.ilike(f"%{keyword}%"),
                Room.memo.ilike(f"%{keyword}%"),
            )
        )
    if date_from:
        where.append(Room.created_at >= coerce_date(date_from, "date_from"))
    if date_to:
        where.append(Room.created_at <= datetime.combine(coerce_date(date_to, "date_to"), time.max))

    # scope
    # 센터 공용 — owner_scope 행 필터 없음

    # project
    # sort 미지정 기본 = name ASC (repo resolve_sort default_col="name")
    stmt = (
        select(
            Room.id,
            Room.name,
            Room.is_active,
            Room.description,
            Room.memo,
            Room.thumbnail_url,
            Room.inactive_reason,
        )
        .where(*where)
        .order_by(sorts.get(sort, Room.name.asc()), Room.id)
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
    "name": "query_room_handler",
    "permission": "read:room",
    "purpose": "상담실을 이름·활성 여부·설명으로 유연 조회한다.",
    "keywords": ["query room", "상담실", "상담실 목록", "룸 조회", "장소"],
    "boundaries": "읽기 전용 상담실 유연 조회. 특정 시간 사용 가능 여부·예약 현황은 일정/가용성 도구. 상담실로는 내담자를 거를 수 없음 — 내담자 기준은 query_client·query_case(client_id).",
    "output": "{rows: 상담실 dict 배열 (fields로 절삭)., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "title": "상담실 이름 검색"},
            "is_active": {"type": "boolean", "title": "활성 여부"},
            "keyword": {"type": "string", "title": "설명·메모 키워드 검색"},
            "date_from": {"type": "string", "format": "date", "title": "생성일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "생성일 종료"},
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["latest", "oldest"],
                "description": "'최신순'→latest, '오래된 순'→oldest",
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
