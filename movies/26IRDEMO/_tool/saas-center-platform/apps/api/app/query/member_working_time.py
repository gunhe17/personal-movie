"""query_member_working_time — 구성원 근무시간 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import case, select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member.models import Member
from app.modules.center.member_working_time.models import MemberWorkingTime
from app.modules.person.person.models import Person
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


def _normalize_weekday(v: str | None) -> str | None:
    if not v:
        return None
    key = v.strip().lower()
    if key in _WEEKDAY_MAP:
        return _WEEKDAY_MAP[key]
    upper = v.strip().upper()[:3]
    return upper if upper in _WEEKDAY_CODES else None


async def query_member_working_time_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 센터 운영 설정, 행 단위 필터 없음
    member_id: str | None = None,
    member_ids: list[str] | None = None,
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
    namespace = "member_working_time"
    # D13 쌍 — member_name의 원천 id는 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "member_id",
        "weekday",
    )
    opt_in = ()

    sorts = {
        "latest": MemberWorkingTime.created_at.desc(),
        "oldest": MemberWorkingTime.created_at.asc(),
    }
    # 구 repo tie-break — member_id·요일 고정 순서
    weekday_order = case(
        {"MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 7},
        value=MemberWorkingTime.weekday,
    )

    # filters
    where = [
        MemberWorkingTime.center_id == center_id,
        MemberWorkingTime.deleted_at.is_(None),
    ]

    collected = list(ids or [])
    if id:
        collected.append(id)
    if collected:
        where.append(MemberWorkingTime.id.in_(collected))

    mid_set = set(member_ids or [])
    if member_id:
        mid_set.add(member_id)
    if mid_set:
        where.append(MemberWorkingTime.member_id.in_(mid_set))

    normalized_weekday = _normalize_weekday(weekday)
    if normalized_weekday:
        where.append(MemberWorkingTime.weekday == normalized_weekday)

    if date_from:
        where.append(
            MemberWorkingTime.created_at
            >= datetime.combine(coerce_date(date_from, "date_from"), time.min)
        )
    if date_to:
        where.append(
            MemberWorkingTime.created_at
            <= datetime.combine(coerce_date(date_to, "date_to"), time.max)
        )

    # scope
    # 센터 운영 설정 — owner_scope 행 필터 없음

    # project
    stmt = (
        select(
            MemberWorkingTime.id,
            MemberWorkingTime.member_id,
            MemberWorkingTime.weekday,
            MemberWorkingTime.start_time,
            MemberWorkingTime.end_time,
            MemberWorkingTime.break_start_time,
            MemberWorkingTime.break_end_time,
            Person.name.label("member_name"),
        )
        .outerjoin(Member, Member.id == MemberWorkingTime.member_id)
        .outerjoin(Person, Person.id == Member.person_id)
        .where(*where)
        .order_by(
            sorts.get(sort or "latest", sorts["latest"]),
            MemberWorkingTime.member_id,
            weekday_order,
            MemberWorkingTime.id,
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
    "name": "query_member_working_time_handler",
    "permission": "read:center",
    "purpose": "구성원(상담사)의 요일별 근무시간을 구성원·요일로 유연 조회한다.",
    "keywords": [
        "query member working time",
        "근무시간",
        "상담사 근무시간",
        "요일별 근무",
        "근무 요일",
        "출근 시간",
    ],
    "boundaries": "읽기 전용 구성원 근무시간 조회. 휴무·비근무 예외(MemberNonWorkingTime)와 특정 날짜의 예약 가능 여부는 포함하지 않는다 — 가용성은 가용성 도구로. 구성원 이름은 query_member_handler로 id를 얻어 member_id/member_ids로 전달.",
    "output": "{rows: 근무시간 dict 배열 (fields로 절삭). 행에 member_name 동반., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "구성원 필터",
                "description": "이름은 query_member_handler로 id 확인 후 넘긴다.",
            },
            "member_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "구성원 필터 복수",
            },
            "weekday": {
                "type": "string",
                "title": "요일",
                "enum": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
                "description": "'월요일'→MON, '화요일'→TUE, '수요일'→WED, '목요일'→THU, '금요일'→FRI, '토요일'→SAT, '일요일'→SUN",
            },
            "date_from": {"type": "string", "format": "date", "title": "등록일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "등록일 종료"},
            "id": {"type": "string", "format": "uuid", "title": "근무시간 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "근무시간 ID 복수",
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
