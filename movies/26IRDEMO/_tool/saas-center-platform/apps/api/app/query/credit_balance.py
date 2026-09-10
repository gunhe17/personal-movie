"""query_credit_balance — AI 크레딧 잔액 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.llm.credit_balance.models import CreditBalance
from app.infrastructure.persistence.agent_query import fetch


async def query_credit_balance_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 센터당 크레딧 잔액 1건, 행 필터 없음
    plan_type: str | None = None,
    credit_limit_min: int | None = None,
    credit_limit_max: int | None = None,
    credit_used_min: int | None = None,
    credit_used_max: int | None = None,
    period_start_from: str | date | None = None,
    period_start_to: str | date | None = None,
    period_end_from: str | date | None = None,
    period_end_to: str | date | None = None,
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
    namespace = "credit_balance"
    identity = ("id",)
    opt_in = ()

    sorts = {
        "latest": CreditBalance.created_at.desc(),
        "oldest": CreditBalance.created_at.asc(),
        "credit_limit_high": CreditBalance.credit_limit.desc(),
        "credit_limit_low": CreditBalance.credit_limit.asc(),
        "credit_used_high": CreditBalance.credit_used.desc(),
        "credit_used_low": CreditBalance.credit_used.asc(),
        "period_start_earliest": CreditBalance.period_start.asc(),
        "period_start_latest": CreditBalance.period_start.desc(),
        "period_end_earliest": CreditBalance.period_end.asc(),
        "period_end_latest": CreditBalance.period_end.desc(),
    }

    # filters
    where = [
        CreditBalance.center_id == center_id,
        CreditBalance.deleted_at.is_(None),
    ]

    collected = list(ids or [])
    if id:
        collected.append(id)
    if collected:
        where.append(CreditBalance.id.in_(collected))

    if plan_type:
        where.append(CreditBalance.plan_type == plan_type)
    if credit_limit_min is not None:
        where.append(CreditBalance.credit_limit >= credit_limit_min)
    if credit_limit_max is not None:
        where.append(CreditBalance.credit_limit <= credit_limit_max)
    if credit_used_min is not None:
        where.append(CreditBalance.credit_used >= credit_used_min)
    if credit_used_max is not None:
        where.append(CreditBalance.credit_used <= credit_used_max)

    for col, lo, hi, lo_name, hi_name in (
        (
            CreditBalance.period_start,
            period_start_from,
            period_start_to,
            "period_start_from",
            "period_start_to",
        ),
        (
            CreditBalance.period_end,
            period_end_from,
            period_end_to,
            "period_end_from",
            "period_end_to",
        ),
        (CreditBalance.created_at, date_from, date_to, "date_from", "date_to"),
    ):
        lo_d = coerce_date(lo, lo_name)
        hi_d = coerce_date(hi, hi_name)
        if lo_d:
            where.append(col >= datetime.combine(lo_d, time.min))
        if hi_d:
            where.append(col <= datetime.combine(hi_d, time.max))

    # scope
    # 센터당 1건 — owner_scope 행 필터 없음

    # project
    stmt = (
        select(
            CreditBalance.id,
            CreditBalance.plan_type,
            CreditBalance.credit_limit,
            CreditBalance.credit_used,
            CreditBalance.period_start,
            CreditBalance.period_end,
        )
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), CreditBalance.id)
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
    "name": "query_credit_balance_handler",
    "permission": None,
    "purpose": "센터의 현재 AI 크레딧 잔액을 요금제·한도·사용량으로 유연 조회한다.",
    "keywords": [
        "query credit balance",
        "크레딧",
        "크레딧 잔액",
        "AI 크레딧",
        "크레딧 사용량",
        "크레딧 한도",
    ],
    "boundaries": "읽기 전용 크레딧 잔액 유연 조회. 현재 기간 잔액(한도−사용=잔여). 사용 이력·일별 사용량 상세는 이 도구 밖. 구독 요금제는 query_subscription_handler.",
    "output": "{rows: 크레딧 잔액 dict 배열 (fields로 절삭) — 현재 기간 잔액. 잔여 = credit_limit−credit_used., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "plan_type": {
                "type": "string",
                "title": "요금제",
                "enum": ["free", "starter", "pro", "enterprise"],
                "description": "'무료'→free, '스타터'→starter, '프로'→pro, '엔터프라이즈'→enterprise",
            },
            "credit_limit_min": {"type": "integer", "title": "크레딧 한도 하한"},
            "credit_limit_max": {"type": "integer", "title": "크레딧 한도 상한"},
            "credit_used_min": {
                "type": "integer",
                "title": "사용 크레딧 하한",
                "description": "'크레딧 쓴'→1",
            },
            "credit_used_max": {"type": "integer", "title": "사용 크레딧 상한"},
            "period_start_from": {"type": "string", "format": "date", "title": "기간 시작일 시작"},
            "period_start_to": {"type": "string", "format": "date", "title": "기간 시작일 종료"},
            "period_end_from": {"type": "string", "format": "date", "title": "기간 종료(갱신)일 시작"},
            "period_end_to": {
                "type": "string",
                "format": "date",
                "title": "기간 종료(갱신)일 종료",
                "description": "'이번 달 갱신'→이번 달 말일",
            },
            "date_from": {"type": "string", "format": "date", "title": "생성일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "생성일 종료"},
            "id": {"type": "string", "format": "uuid", "title": "크레딧 잔액 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "크레딧 잔액 ID 복수",
            },
            "sort": {
                "type": "string",
                "enum": [
                    "latest",
                    "oldest",
                    "credit_limit_high",
                    "credit_limit_low",
                    "credit_used_high",
                    "credit_used_low",
                    "period_start_earliest",
                    "period_start_latest",
                    "period_end_earliest",
                    "period_end_latest",
                ],
                "title": "정렬",
                "description": "'최신순'→latest(기본), '한도 큰순'→credit_limit_high, '많이 쓴순'→credit_used_high, '기간 시작 임박순'→period_start_earliest, '갱신 임박순'→period_end_earliest",
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
