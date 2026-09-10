"""query_institution — 연계 기관 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import String, select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.institution.institution.models import Institution
from app.infrastructure.persistence.agent_query import fetch


async def query_institution_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 공용 기관 카탈로그, 행 필터 없음
    name: str | None = None,
    phone: str | None = None,
    address: str | None = None,
    limit: int | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "institution"
    identity = (
        "id",
        "name",
    )
    opt_in = (  # select엔 있으나 기본 출력에선 빠짐 — fields로만
        "phone",
        "address",
        "created_at",
    )
    sorts = {
        "latest": Institution.created_at.desc(),
        "oldest": Institution.created_at.asc(),
    }

    # filters — 글로벌 카탈로그(Institution에 center_id 컬럼 없음).
    # CI tenant token: center_id == 는 모델에 없어 적용 불가 — 시그니처만 소비.
    _ = center_id
    where = [
        Institution.deleted_at.is_(None),
    ]

    if name:
        where.append(Institution.name.ilike(f"%{name}%"))
    if phone:
        where.append(Institution.phone.ilike(f"%{phone}%"))
    if address:
        where.append(Institution.address.cast(String).ilike(f"%{address}%"))
    if date_from:
        where.append(Institution.created_at >= coerce_date(date_from, "date_from"))
    if date_to:
        where.append(Institution.created_at <= datetime.combine(coerce_date(date_to, "date_to"), time.max))

    # scope
    # 글로벌 공용 — owner_scope 행 필터 없음

    # project
    # sort 미지정 기본 = name ASC (repo resolve_sort default_col="name")
    stmt = (
        select(
            Institution.id,
            Institution.name,
            Institution.phone,
            Institution.address,
            Institution.created_at,
        )
        .where(*where)
        .order_by(sorts.get(sort, Institution.name.asc()), Institution.id)
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
    "name": "query_institution_handler",
    "permission": None,
    "purpose": "연계 기관을 이름·연락처로 유연 조회한다.",
    "keywords": ["query institution", "기관 조회", "연계 기관", "기관 연락처"],
    "boundaries": "읽기 전용 기관 카탈로그 유연 조회.",
    "output": "{rows: 기관 dict 배열 (fields로 절삭)., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "title": "기관명 검색"},
            "phone": {"type": "string", "title": "전화번호 검색"},
            "address": {"type": "string", "title": "주소 키워드"},
            "limit": {"type": "integer", "title": "최대 개수"},
            "date_from": {"type": "string", "format": "date", "title": "생성일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "생성일 종료"},
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["latest", "oldest"],
                "description": "'최신순'→latest, '오래된 순'→oldest",
            },
            "fields": {
                "type": "array",
                "items": {"type": "string"},
                "title": "반환 필드",
            },
        },
        "required": [],
    },
}
