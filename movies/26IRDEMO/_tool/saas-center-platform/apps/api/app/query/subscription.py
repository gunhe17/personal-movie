"""query_subscription — 센터 구독 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.subscription.models import Subscription
from app.infrastructure.persistence.agent_query import fetch


async def query_subscription_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 센터당 구독 1건, 행 필터 없음
    plan: str | None = None,
    status: str | None = None,
    reserved_plan: str | None = None,
    is_quota_exceeded: bool | None = None,
    current_period_start_from: str | date | None = None,
    current_period_start_to: str | date | None = None,
    current_period_end_from: str | date | None = None,
    current_period_end_to: str | date | None = None,
    trial_end_from: str | date | None = None,
    trial_end_to: str | date | None = None,
    cancelled_from: str | date | None = None,
    cancelled_to: str | date | None = None,
    quota_grace_end_from: str | date | None = None,
    quota_grace_end_to: str | date | None = None,
    reserved_from: str | date | None = None,
    reserved_to: str | date | None = None,
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
    namespace = "subscription"
    identity = ("id",)
    opt_in = ()

    sorts = {
        "latest": Subscription.created_at.desc(),
        "oldest": Subscription.created_at.asc(),
        "current_period_end_earliest": Subscription.current_period_end.asc(),
        "current_period_end_latest": Subscription.current_period_end.desc(),
        "current_period_start_earliest": Subscription.current_period_start.asc(),
        "current_period_start_latest": Subscription.current_period_start.desc(),
        "trial_end_earliest": Subscription.trial_end.asc(),
        "trial_end_latest": Subscription.trial_end.desc(),
        "cancelled_earliest": Subscription.cancelled_at.asc(),
        "cancelled_latest": Subscription.cancelled_at.desc(),
        "quota_grace_end_earliest": Subscription.quota_grace_end.asc(),
        "quota_grace_end_latest": Subscription.quota_grace_end.desc(),
        "reserved_earliest": Subscription.reserved_at.asc(),
        "reserved_latest": Subscription.reserved_at.desc(),
    }

    # filters
    where = [
        Subscription.center_id == center_id,
        Subscription.deleted_at.is_(None),
    ]

    collected = list(ids or [])
    if id:
        collected.append(id)
    if collected:
        where.append(Subscription.id.in_(collected))

    if plan:
        where.append(Subscription.plan == plan)
    if status:
        where.append(Subscription.status == status)
    if reserved_plan:
        where.append(Subscription.reserved_plan == reserved_plan)
    if is_quota_exceeded is not None:
        where.append(Subscription.is_quota_exceeded.is_(is_quota_exceeded))

    for col, lo, hi, lo_name, hi_name in (
        (
            Subscription.current_period_start,
            current_period_start_from,
            current_period_start_to,
            "current_period_start_from",
            "current_period_start_to",
        ),
        (
            Subscription.current_period_end,
            current_period_end_from,
            current_period_end_to,
            "current_period_end_from",
            "current_period_end_to",
        ),
        (
            Subscription.trial_end,
            trial_end_from,
            trial_end_to,
            "trial_end_from",
            "trial_end_to",
        ),
        (
            Subscription.cancelled_at,
            cancelled_from,
            cancelled_to,
            "cancelled_from",
            "cancelled_to",
        ),
        (
            Subscription.quota_grace_end,
            quota_grace_end_from,
            quota_grace_end_to,
            "quota_grace_end_from",
            "quota_grace_end_to",
        ),
        (
            Subscription.reserved_at,
            reserved_from,
            reserved_to,
            "reserved_from",
            "reserved_to",
        ),
        (Subscription.created_at, date_from, date_to, "date_from", "date_to"),
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
            Subscription.id,
            Subscription.plan,
            Subscription.status,
            Subscription.current_period_start,
            Subscription.current_period_end,
            Subscription.trial_end,
            Subscription.cancelled_at,
            Subscription.is_quota_exceeded,
            Subscription.quota_grace_end,
            Subscription.reserved_plan,
            Subscription.reserved_at,
        )
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), Subscription.id)
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
    "name": "query_subscription_handler",
    "permission": None,
    "purpose": "센터 구독을 요금제·상태·갱신 기간·체험 만료로 유연 조회한다.",
    "keywords": [
        "query subscription",
        "구독",
        "요금제",
        "플랜",
        "구독 상태",
        "체험",
    ],
    "boundaries": "읽기 전용 구독 유연 조회. 센터당 활성 구독 1건. 결제 내역·요금 이력은 이 도구 밖. 크레딧 잔액은 query_credit_balance_handler.",
    "output": "{rows: 구독 dict 배열 (fields로 절삭) — 센터당 현재 구독 1건., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "plan": {
                "type": "string",
                "title": "요금제",
                "enum": ["free", "starter", "pro", "enterprise"],
                "description": "'무료'→free, '스타터'→starter, '프로'→pro, '엔터프라이즈'→enterprise",
            },
            "status": {
                "type": "string",
                "title": "구독 상태",
                "enum": [
                    "active",
                    "trial",
                    "pending",
                    "pending_payment",
                    "payment_failed",
                    "expired",
                    "cancelled",
                ],
                "description": "'활성/이용중'→active, '체험'→trial, '결제대기'→pending_payment, '결제실패'→payment_failed, '만료'→expired, '취소'→cancelled",
            },
            "reserved_plan": {
                "type": "string",
                "title": "예약된 다운그레이드 요금제",
                "enum": ["free", "starter", "pro", "enterprise"],
                "description": "다음 기간부터 적용 예약된 요금제. '다운그레이드 예약된'→해당 값 지정",
            },
            "is_quota_exceeded": {
                "type": "boolean",
                "title": "쿼터(크레딧) 초과 여부",
            },
            "current_period_start_from": {"type": "string", "format": "date", "title": "현재 기간 시작일 시작"},
            "current_period_start_to": {"type": "string", "format": "date", "title": "현재 기간 시작일 종료"},
            "current_period_end_from": {"type": "string", "format": "date", "title": "현재 기간 종료(갱신)일 시작"},
            "current_period_end_to": {
                "type": "string",
                "format": "date",
                "title": "현재 기간 종료(갱신)일 종료",
                "description": "'이번 달 갱신/만료'→이번 달 말일",
            },
            "trial_end_from": {"type": "string", "format": "date", "title": "체험 만료일 시작"},
            "trial_end_to": {
                "type": "string",
                "format": "date",
                "title": "체험 만료일 종료",
                "description": "'체험 곧 끝나는'→오늘~가까운 미래",
            },
            "cancelled_from": {"type": "string", "format": "date", "title": "취소일 시작"},
            "cancelled_to": {"type": "string", "format": "date", "title": "취소일 종료"},
            "quota_grace_end_from": {"type": "string", "format": "date", "title": "쿼터 유예 종료일 시작"},
            "quota_grace_end_to": {"type": "string", "format": "date", "title": "쿼터 유예 종료일 종료"},
            "reserved_from": {"type": "string", "format": "date", "title": "다운그레이드 예약일 시작"},
            "reserved_to": {"type": "string", "format": "date", "title": "다운그레이드 예약일 종료"},
            "date_from": {"type": "string", "format": "date", "title": "생성일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "생성일 종료"},
            "id": {"type": "string", "format": "uuid", "title": "구독 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "구독 ID 복수",
            },
            "sort": {
                "type": "string",
                "enum": [
                    "latest", "oldest",
                    "current_period_end_earliest", "current_period_end_latest",
                    "current_period_start_earliest", "current_period_start_latest",
                    "trial_end_earliest", "trial_end_latest",
                    "cancelled_earliest", "cancelled_latest",
                    "quota_grace_end_earliest", "quota_grace_end_latest",
                    "reserved_earliest", "reserved_latest",
                ],
                "title": "정렬",
                "description": "'최신순'→latest(기본), '오래된순'→oldest, '갱신 임박순'→current_period_end_earliest, '체험 만료 임박순'→trial_end_earliest",
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
