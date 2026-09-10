"""query_payment — 결제 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import literal, select
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.billable.models import Billable
from app.modules.billing.payment.models import Payment
from app.infrastructure.persistence.agent_query import fetch


async def query_payment_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 결제는 read:billing 게이트의 센터 단위 조회
    billable_id: str | None = None,
    billable_ids: list[str] | None = None,
    payment_method: str | None = None,
    amount_min: int | None = None,
    amount_max: int | None = None,
    paid_from: str | date | None = None,
    paid_to: str | date | None = None,
    receipt_number: str | None = None,
    keyword: str | None = None,
    id: str | None = None,
    ids: list[str] | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "payment"
    # D13 쌍 — billable_name→billable_id
    identity = (
        "id",
        "billable_id",
    )
    opt_in = ("memo",)
    sorts = {
        "latest": Payment.paid_at.desc(),
        "oldest": Payment.paid_at.asc(),
        "amount_high": Payment.amount.desc(),
        "amount_low": Payment.amount.asc(),
        "paid_earliest": Payment.paid_at.asc(),
        "paid_latest": Payment.paid_at.desc(),
    }

    # filters — Payment에 center_id 없음 → Billable 조인으로 테넌시
    where = [
        Billable.center_id == center_id,
        Billable.deleted_at.is_(None),
        Payment.deleted_at.is_(None),
    ]

    all_ids = [*(ids or []), *([id] if id else [])]
    if all_ids:
        where.append(Payment.id.in_(all_ids))
    all_billable_ids = [*(billable_ids or []), *([billable_id] if billable_id else [])]
    if all_billable_ids:
        where.append(Payment.billable_id.in_(all_billable_ids))
    if payment_method:
        where.append(Payment.payment_method == payment_method)
    if amount_min is not None:
        where.append(Payment.amount >= amount_min)
    if amount_max is not None:
        where.append(Payment.amount <= amount_max)
    if paid_from:
        where.append(
            Payment.paid_at
            >= datetime.combine(coerce_date(paid_from, "paid_from"), time.min)
        )
    if paid_to:
        where.append(
            Payment.paid_at
            <= datetime.combine(coerce_date(paid_to, "paid_to"), time.max)
        )
    if receipt_number:
        where.append(Payment.receipt_number.ilike(f"%{receipt_number}%"))
    if keyword:
        where.append(Payment.memo.ilike(f"%{keyword}%"))

    # project
    # "{YYYY-MM-DD} · {amount:,}원" — BillableFacade.get_billable_summaries_by_ids 동치
    billable_name = func.to_char(Billable.billable_date, "YYYY-MM-DD").concat(
        literal(" · ")
    ).concat(
        func.to_char(Billable.total_amount, "FM999,999,999,999").concat(literal("원"))
    )

    stmt = (
        select(
            Payment.id,
            Payment.billable_id,
            Payment.amount,
            Payment.payment_method,
            Payment.paid_at,
            Payment.receipt_number,
            Payment.memo,
            billable_name.label("billable_name"),
        )
        .join(Billable, Billable.id == Payment.billable_id)
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), Payment.id)
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
    "name": "query_payment_handler",
    "permission": "read:billing",
    "purpose": "결제 내역을 청구서·결제수단·금액·결제일·영수증번호로 유연 조회한다.",
    "keywords": [
        "query payment",
        "결제 내역",
        "결제 조회",
        "입금",
        "수납",
        "영수증",
    ],
    "boundaries": "읽기 전용 결제 유연 조회. 청구서(내담자 포함) 이름은 query_billable_handler로 id를 얻어 billable_id/billable_ids로 전달. 등록자(created_by)로는 거를 수 없음 — 필요 시 청구서 기준으로.",
    "output": "{rows: 결제 dict 배열 (fields로 절삭). 정렬: 결제일 기준. 행에 billable_name(청구서 표시명) 동반., aggregate: {count(전체 건수), exact(false면 하한)}}. '몇 건' 질문은 aggregate를 읽는다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "billable_id": {
                "type": "string",
                "format": "uuid",
                "title": "청구서 필터",
                "description": "청구서/내담자 이름은 query_billable_handler로 id 확인 후 넘긴다.",
            },
            "billable_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "청구서 필터 복수",
            },
            "payment_method": {
                "type": "string",
                "title": "결제수단",
                "enum": ["card", "transfer", "cash", "legacy"],
                "description": "'카드'→card, '계좌이체/이체'→transfer, '현금'→cash",
            },
            "amount_min": {"type": "integer", "title": "결제액 하한 (원)"},
            "amount_max": {"type": "integer", "title": "결제액 상한 (원)"},
            "paid_from": {"type": "string", "format": "date", "title": "결제일 시작"},
            "paid_to": {"type": "string", "format": "date", "title": "결제일 종료"},
            "receipt_number": {"type": "string", "title": "영수증번호"},
            "keyword": {"type": "string", "title": "메모 키워드"},
            "id": {"type": "string", "format": "uuid", "title": "결제 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "결제 ID 복수",
            },
            "sort": {
                "type": "string",
                "enum": ["latest", "oldest", "amount_high", "amount_low", "paid_earliest", "paid_latest"],
                "title": "정렬",
                "description": "'최신순'→latest(결제일 기준, 기본), '금액 큰순'→amount_high, '결제 오래된순'→paid_earliest, '결제 최근순'→paid_latest",
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
