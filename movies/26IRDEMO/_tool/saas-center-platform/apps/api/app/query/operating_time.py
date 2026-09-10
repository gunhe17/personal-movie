"""query_operating_time — 센터 운영시간 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import case, select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.center_operating_time.models import OperatingTime
from app.infrastructure.persistence.agent_query import fetch

_WEEKDAY_CODES = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}
_WEEKDAY_MAP = {
    "monday": "MON",
    "tuesday": "TUE",
    "wednesday": "WED",
    "thursday": "THU",
    "friday": "FRI",
    "saturday": "SAT",
    "sunday": "SUN",
    "월요일": "MON",
    "화요일": "TUE",
    "수요일": "WED",
    "목요일": "THU",
    "금요일": "FRI",
    "토요일": "SAT",
    "일요일": "SUN",
}
_WEEKDAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


async def query_operating_time_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 센터 운영 설정, 행 단위 필터 없음
    weekday: str | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    id: str | None = None,
    ids: list[str] | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "operating_time"
    identity = (
        "id",
        "weekday",
    )
    opt_in = ()  # AVAILABLE == DEFAULT
    sorts = {
        "latest": OperatingTime.created_at.desc(),
        "oldest": OperatingTime.created_at.asc(),
    }

    def normalize_weekday(value: str | None) -> str | None:
        """OperatingTimeFacade._normalize_weekday 동치."""
        if not value:
            return None
        key = value.strip().lower()
        if key in _WEEKDAY_MAP:
            return _WEEKDAY_MAP[key]
        upper = value.strip().upper()[:3]
        return upper if upper in _WEEKDAY_CODES else None

    collected = list(ids or [])
    if id:
        collected.append(id)
    merged_ids = collected or None
    weekday_norm = normalize_weekday(weekday)

    # filters
    where = [
        OperatingTime.center_id == center_id,
        OperatingTime.deleted_at.is_(None),
    ]

    if merged_ids is not None:
        where.append(OperatingTime.id.in_(merged_ids))
    if weekday_norm:
        where.append(OperatingTime.weekday == weekday_norm)
    if date_from:
        where.append(OperatingTime.created_at >= coerce_date(date_from, "date_from"))
    if date_to:
        where.append(OperatingTime.created_at <= datetime.combine(coerce_date(date_to, "date_to"), time.max))

    # scope
    # 센터 공용 — owner_scope 행 필터 없음

    # project
    weekday_order = case(
        {day: index for index, day in enumerate(_WEEKDAY_ORDER, start=1)},
        value=OperatingTime.weekday,
    )
    stmt = (
        select(
            OperatingTime.id,
            OperatingTime.weekday,
            OperatingTime.open_time,
            OperatingTime.close_time,
            OperatingTime.break_start_time,
            OperatingTime.break_end_time,
        )
        .where(*where)
        .order_by(
            sorts.get(sort or "latest", sorts["latest"]),
            weekday_order,
            OperatingTime.id,
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
    "name": "query_operating_time_handler",
    "permission": "read:center",
    "purpose": "센터 운영시간(요일별 개점·마감·휴게)을 요일로 유연 조회한다.",
    "keywords": [
        "query operating time",
        "운영시간",
        "영업시간",
        "센터 운영시간",
        "요일별 운영",
        "개점 마감",
    ],
    "boundaries": "읽기 전용 센터 운영시간 조회. 휴무일·비운영 예외(NonOperatingTime)와 특정 날짜의 영업 여부는 포함하지 않는다 — 그 날짜 영업 여부는 가용성/운영상태 도구로. 상담사 개인 근무시간은 query_member_working_time_handler.",
    "output": "{rows: 운영시간 dict 배열 (fields로 절삭)., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "weekday": {
                "type": "string",
                "title": "요일",
                "enum": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
                "description": "'월요일'→MON, '화요일'→TUE, '수요일'→WED, '목요일'→THU, '금요일'→FRI, '토요일'→SAT, '일요일'→SUN",
            },
            "date_from": {"type": "string", "format": "date", "title": "등록일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "등록일 종료"},
            "id": {"type": "string", "format": "uuid", "title": "운영시간 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "운영시간 ID 복수",
            },
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
