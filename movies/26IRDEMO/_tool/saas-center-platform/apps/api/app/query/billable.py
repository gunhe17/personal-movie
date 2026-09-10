"""query_billable — 청구 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import literal_column, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.billable.models import Billable
from app.modules.billing.billable_item.models import BillableItem
from app.modules.client.profile.models import Client
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_billable_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 청구는 read:billing 게이트의 센터 단위 조회
    status: str | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    amount_min: int | None = None,
    amount_max: int | None = None,
    unpaid_amount_min: int | None = None,
    unpaid_amount_max: int | None = None,
    due_from: str | date | None = None,
    due_to: str | date | None = None,
    issued_from: str | date | None = None,
    issued_to: str | date | None = None,
    keyword: str | None = None,
    client_id: str | None = None,
    client_ids: list[str] | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "billable"
    # D13 쌍 — client_name→client_id. created_by_name은 WAIVER(opt_in)
    identity = (
        "id",
        "client_id",
        "status",
    )
    opt_in = (
        "memo",
        "center_id",
        "created_by",
        "created_by_name",
    )
    sorts = {
        "latest": Billable.created_at.desc(),
        "oldest": Billable.created_at.asc(),
        "total_amount_high": Billable.total_amount.desc(),
        "total_amount_low": Billable.total_amount.asc(),
        "unpaid_amount_high": Billable.unpaid_amount.desc(),
        "unpaid_amount_low": Billable.unpaid_amount.asc(),
        "paid_amount_high": Billable.paid_amount.desc(),
        "paid_amount_low": Billable.paid_amount.asc(),
        "due_earliest": Billable.due_date.asc(),
        "due_latest": Billable.due_date.desc(),
        "issued_earliest": Billable.issued_at.asc(),
        "issued_latest": Billable.issued_at.desc(),
    }

    # filters
    where = [
        Billable.center_id == center_id,
        Billable.deleted_at.is_(None),
    ]

    if status:
        where.append(Billable.status == status)
    all_client_ids = [*(client_ids or []), *([client_id] if client_id else [])]
    if all_client_ids:
        where.append(Billable.client_id.in_(all_client_ids))
    if date_from:
        where.append(Billable.billable_date >= coerce_date(date_from, "date_from"))
    if date_to:
        where.append(Billable.billable_date <= coerce_date(date_to, "date_to"))
    if due_from or due_to:
        where.append(Billable.due_date.is_not(None))
        if due_from:
            where.append(Billable.due_date >= coerce_date(due_from, "due_from"))
        if due_to:
            where.append(Billable.due_date <= coerce_date(due_to, "due_to"))
    if issued_from or issued_to:
        where.append(Billable.issued_at.is_not(None))
        if issued_from:
            where.append(
                Billable.issued_at
                >= datetime.combine(coerce_date(issued_from, "issued_from"), time.min)
            )
        if issued_to:
            where.append(
                Billable.issued_at
                <= datetime.combine(coerce_date(issued_to, "issued_to"), time.max)
            )
    if amount_min is not None:
        where.append(Billable.total_amount >= amount_min)
    if amount_max is not None:
        where.append(Billable.total_amount <= amount_max)
    if unpaid_amount_min is not None:
        where.append(func.coalesce(Billable.unpaid_amount, 0) >= unpaid_amount_min)
    if unpaid_amount_max is not None:
        where.append(func.coalesce(Billable.unpaid_amount, 0) <= unpaid_amount_max)
    if keyword:
        where.append(Billable.memo.ilike(f"%{keyword}%"))

    # project
    stmt = (
        select(
            Billable.id,
            Billable.center_id,
            Billable.client_id,
            Billable.status,
            Billable.total_amount,
            Billable.unpaid_amount,
            Billable.paid_amount,
            Billable.billable_date,
            Billable.due_date,
            Billable.issued_at,
            Billable.memo,
            Billable.created_by,
            Client.name.label("client_name"),
            Person.name.label("created_by_name"),
            # array_agg는 행 0이면 NULL
            func.coalesce(
                func.array_remove(
                    func.array_agg(
                        aggregate_order_by(
                            BillableItem.description,
                            BillableItem.id,
                        )
                    ),
                    None,
                ),
                literal_column("'{}'::text[]"),
            ).label("item_names"),
        )
        .outerjoin(Client, Client.id == Billable.client_id)
        .outerjoin(
            Person,
            (Person.account_id == Billable.created_by)
            & Person.deleted_at.is_(None),
        )
        .outerjoin(
            BillableItem,
            (BillableItem.billable_id == Billable.id)
            & BillableItem.deleted_at.is_(None),
        )
        .where(*where)
        .group_by(Billable.id, Client.name, Person.name)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), Billable.id)
    )

    # return
    rows, _ = await fetch(
        uow.session,
        stmt,
        limit=200,  # 구 facade 상한 — TOOL에 limit이 없어 모델이 못 준다
        namespace=namespace if namespaced else None,
        identity=identity,
        fields=fields,
        opt_in=opt_in,
    )

    # aggregate — 구 AggregateBillablesService 동치 (행 절삭과 무관)
    agg = (
        await uow.session.execute(
            select(
                func.count(),
                func.coalesce(func.sum(Billable.total_amount), 0),
                func.coalesce(func.sum(Billable.unpaid_amount), 0),
            ).where(*where)
        )
    ).one()

    return {
        "rows": rows,
        "aggregate": {
            "count": int(agg[0]),
            "total_amount_sum": int(agg[1]),
            "unpaid_amount_sum": int(agg[2]),
            "exact": True,
        },
    }


TOOL = {
    "name": "query_billable_handler",
    "permission": "read:billing",
    "purpose": "청구/결제 내역을 상태·기간·금액·미납 여부로 유연 조회한다.",
    "keywords": ["query billable", "청구 조회", "미납", "연체", "결제 내역", "청구서"],
    "boundaries": "읽기 전용 청구 유연 조회. 내담자 이름은 query_client_handler로 id를 얻어 client_id/client_ids로 전달. 가격표는 query_price_list_handler.",
    "output": "{rows: 청구 행(fields 절삭, 최신순, 행에 client_name·item_names(청구 항목명) 동반), aggregate: {count, total_amount_sum, unpaid_amount_sum} — DB 집계라 행 절삭과 무관하게 정확}. '총액/몇 건' 질문은 aggregate를 읽는다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "청구 상태",
                "enum": ["issued", "paid"],
                "description": "'발행/미결제'→issued, '결제완료/납부'→paid. 미납은 unpaid_amount_min=1, 연체는 due_to",
            },
            "date_from": {"type": "string", "format": "date", "title": "청구일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "청구일 종료"},
            "amount_min": {"type": "integer", "title": "총액 하한 (원)"},
            "amount_max": {"type": "integer", "title": "총액 상한 (원)"},
            "unpaid_amount_min": {
                "type": "integer",
                "title": "미납액 하한 (원)",
                "description": "'미납/미수금/안 낸 청구 있는'→1. '10만원 넘게 미납'→100000. 미납 총액·건수는 이걸로(status 아님)",
            },
            "unpaid_amount_max": {"type": "integer", "title": "미납액 상한 (원)"},
            "issued_from": {"type": "string", "format": "date", "title": "발행일 시작"},
            "issued_to": {"type": "string", "format": "date", "title": "발행일 종료"},
            "keyword": {"type": "string", "title": "메모 키워드"},
            "due_from": {"type": "string", "format": "date", "title": "납부기한 시작"},
            "due_to": {
                "type": "string",
                "format": "date",
                "title": "납부기한 종료",
                "description": "'기한 지난'→오늘 이전 = due_to 어제",
            },
            "client_id": {"type": "string", "format": "uuid", "title": "내담자 UUID"},
            "client_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "내담자 UUID 목록",
            },
            "sort": {
                "type": "string",
                "enum": ["latest", "oldest", "total_amount_high", "total_amount_low", "unpaid_amount_high", "unpaid_amount_low", "paid_amount_high", "paid_amount_low", "due_earliest", "due_latest", "issued_earliest", "issued_latest"],
                "title": "정렬",
                "description": "'최신순'→latest(기본), '청구액 큰순'→total_amount_high, '미납 큰순'→unpaid_amount_high, '마감 임박순'→due_earliest, '마감 여유순'→due_latest, '발행 오래된순'→issued_earliest, '발행 최근순'→issued_latest",
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
