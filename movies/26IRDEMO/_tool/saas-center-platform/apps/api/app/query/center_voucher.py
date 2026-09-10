"""query_center_voucher — 센터 취급 바우처 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.voucher.models import Voucher
from app.infrastructure.persistence.agent_query import fetch


async def query_center_voucher_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 바우처는 read:voucher 게이트의 센터 단위 조회
    catalog_id: str | None = None,
    catalog_ids: list[str] | None = None,
    unit_price_min: int | None = None,
    unit_price_max: int | None = None,
    default_total_sessions_min: int | None = None,
    default_total_sessions_max: int | None = None,
    is_active: bool | None = None,
    keyword: str | None = None,
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
    namespace = "center_voucher"
    # D13 쌍 — catalog_name의 원천 id는 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "catalog_id",
    )
    opt_in = ("memo",)

    sorts = {
        "latest": CenterVoucher.created_at.desc(),
        "oldest": CenterVoucher.created_at.asc(),
        "unit_price_high": CenterVoucher.unit_price.desc(),
        "unit_price_low": CenterVoucher.unit_price.asc(),
        "default_total_sessions_high": CenterVoucher.default_total_sessions.desc(),
        "default_total_sessions_low": CenterVoucher.default_total_sessions.asc(),
    }

    # filters
    where = [
        CenterVoucher.center_id == center_id,
        CenterVoucher.deleted_at.is_(None),
    ]

    collected = list(ids or [])
    if id:
        collected.append(id)
    if collected:
        where.append(CenterVoucher.id.in_(collected))

    cat_set = set(catalog_ids or [])
    if catalog_id:
        cat_set.add(catalog_id)
    if cat_set:
        where.append(CenterVoucher.catalog_id.in_(cat_set))

    if unit_price_min is not None:
        where.append(CenterVoucher.unit_price >= unit_price_min)
    if unit_price_max is not None:
        where.append(CenterVoucher.unit_price <= unit_price_max)
    if default_total_sessions_min is not None:
        where.append(CenterVoucher.default_total_sessions >= default_total_sessions_min)
    if default_total_sessions_max is not None:
        where.append(CenterVoucher.default_total_sessions <= default_total_sessions_max)
    if is_active is not None:
        where.append(CenterVoucher.is_active.is_(is_active))
    if keyword:
        where.append(CenterVoucher.memo.ilike(f"%{keyword}%"))
    if date_from:
        where.append(
            CenterVoucher.created_at
            >= datetime.combine(coerce_date(date_from, "date_from"), time.min)
        )
    if date_to:
        where.append(
            CenterVoucher.created_at
            <= datetime.combine(coerce_date(date_to, "date_to"), time.max)
        )

    # scope
    # 센터 단위 조회 — owner_scope 행 필터 없음. created_by 이름 해소 면제(기본 투영 불요)

    # project
    stmt = (
        select(
            CenterVoucher.id,
            CenterVoucher.catalog_id,
            CenterVoucher.unit_price,
            CenterVoucher.default_total_sessions,
            CenterVoucher.is_active,
            CenterVoucher.memo,
            Voucher.name.label("catalog_name"),
        )
        .outerjoin(Voucher, Voucher.id == CenterVoucher.catalog_id)
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), CenterVoucher.id)
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
    "name": "query_center_voucher_handler",
    "permission": "read:voucher",
    "purpose": "센터가 취급하는 바우처(카탈로그 연결)를 활성 여부·단가·기본 회기 수로 유연 조회한다.",
    "keywords": [
        "query center voucher",
        "센터 바우처",
        "취급 바우처",
        "바우처 카탈로그",
        "바우처 단가",
        "바우처 상품",
    ],
    "boundaries": "읽기 전용 센터 취급 바우처 유연 조회. keyword는 메모 검색. 내담자별 보유·잔여 현황은 query_client_voucher_handler.",
    "output": "{rows: 센터 바우처 dict 배열 (fields로 절삭). 행에 catalog_name(카탈로그 바우처명) 동반., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "catalog_id": {
                "type": "string",
                "format": "uuid",
                "title": "카탈로그 바우처 필터",
            },
            "catalog_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "카탈로그 바우처 필터 복수",
            },
            "unit_price_min": {"type": "integer", "title": "단가 하한 (원)"},
            "unit_price_max": {"type": "integer", "title": "단가 상한 (원)"},
            "default_total_sessions_min": {"type": "integer", "title": "기본 회기 수 하한"},
            "default_total_sessions_max": {"type": "integer", "title": "기본 회기 수 상한"},
            "is_active": {"type": "boolean", "title": "활성 여부"},
            "keyword": {"type": "string", "title": "메모 키워드 검색"},
            "date_from": {"type": "string", "format": "date", "title": "등록일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "등록일 종료"},
            "id": {"type": "string", "format": "uuid", "title": "센터 바우처 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "센터 바우처 ID 복수",
            },
            "sort": {
                "type": "string",
                "enum": [
                    "latest",
                    "oldest",
                    "unit_price_high",
                    "unit_price_low",
                    "default_total_sessions_high",
                    "default_total_sessions_low",
                ],
                "title": "정렬",
                "description": "'최신순'→latest(기본), '단가 높은순'→unit_price_high, '회기 많은순'→default_total_sessions_high",
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
