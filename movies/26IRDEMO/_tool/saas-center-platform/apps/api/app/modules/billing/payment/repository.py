from datetime import date, datetime, time

from sqlalchemy import func, select

from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import PostgresRepository
from app.modules.billing.billable.models import Billable

from .models import Payment


class PaymentRepository(PostgresRepository[Payment]):
    model = Payment

    # #
    # command

    @typecheck
    async def add(
        self,
        billable_id: uuid_str,
        amount: int,
        payment_method: str,
        paid_at: utc_dt,
        created_by: uuid_str,
        receipt_number: str | None = None,
        memo: str | None = None,
    ) -> Payment:
        return await super().add(
            Payment(
                billable_id=billable_id,
                amount=amount,
                payment_method=payment_method,
                paid_at=paid_at,
                created_by=created_by,
                receipt_number=receipt_number,
                memo=memo,
            )
        )

    # #
    # query

    @typecheck
    async def list_by_billable(self, billable_id: uuid_str) -> list[Payment]:
        return await self._filter(
            where=[Payment.billable_id == billable_id],
            order_by="paid_at",
        )

    @typecheck
    async def aggregate_by_billable(self, billable_id: uuid_str) -> int:
        return await self._session.scalar(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.billable_id == billable_id,
                Payment.deleted_at.is_(None),
            )
        )

    # payment은 center_id가 없다(billable의 자식) — 센터 스코프는 billables 조인으로(같은 모듈)
    @typecheck
    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        billable_id: str | None = None,
        billable_ids: list[str] | None = None,
        payment_method: str | None = None,
        amount_min: int | None = None,
        amount_max: int | None = None,
        paid_from: date | None = None,
        paid_to: date | None = None,
        receipt_number: str | None = None,
        keyword: str | None = None,
    ) -> list:
        where = [
            Billable.center_id == center_id,
            Billable.deleted_at.is_(None),
            Payment.deleted_at.is_(None),
        ]
        if ids:
            where.append(Payment.id.in_(ids))
        bid_set = set(billable_ids or [])
        if billable_id:
            bid_set.add(billable_id)
        if bid_set:
            where.append(Payment.billable_id.in_(bid_set))
        if payment_method:
            where.append(Payment.payment_method == payment_method)
        if amount_min is not None:
            where.append(Payment.amount >= amount_min)
        if amount_max is not None:
            where.append(Payment.amount <= amount_max)
        if paid_from:
            where.append(Payment.paid_at >= datetime.combine(paid_from, time.min))
        if paid_to:
            where.append(Payment.paid_at <= datetime.combine(paid_to, time.max))
        if receipt_number:
            where.append(Payment.receipt_number.ilike(f"%{receipt_number}%"))
        if keyword:
            where.append(Payment.memo.ilike(f"%{keyword}%"))
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        ids: list[str] | None = None,
        billable_id: str | None = None,
        billable_ids: list[str] | None = None,
        payment_method: str | None = None,
        amount_min: int | None = None,
        amount_max: int | None = None,
        paid_from: date | None = None,
        paid_to: date | None = None,
        receipt_number: str | None = None,
        keyword: str | None = None,
    ) -> list[Payment]:
        where = self._agent_where(
            center_id,
            ids=ids,
            billable_id=billable_id,
            billable_ids=billable_ids,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            paid_from=paid_from,
            paid_to=paid_to,
            receipt_number=receipt_number,
            keyword=keyword,
        )
        col, descending = resolve_sort(
            sort,
            columns=frozenset({"amount"}),
            event_columns={"paid": "paid_at"},
            time_col="paid_at",
            default_col="paid_at",
        )
        order_col = getattr(Payment, col)
        order = order_col.desc() if descending else order_col.asc()
        rows = await self._session.execute(
            select(Payment)
            .join(Billable, Payment.billable_id == Billable.id)
            .where(*where)
            .order_by(order)
            .limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        billable_id: str | None = None,
        billable_ids: list[str] | None = None,
        payment_method: str | None = None,
        amount_min: int | None = None,
        amount_max: int | None = None,
        paid_from: date | None = None,
        paid_to: date | None = None,
        receipt_number: str | None = None,
        keyword: str | None = None,
    ) -> int:
        where = self._agent_where(
            center_id,
            ids=ids,
            billable_id=billable_id,
            billable_ids=billable_ids,
            payment_method=payment_method,
            amount_min=amount_min,
            amount_max=amount_max,
            paid_from=paid_from,
            paid_to=paid_to,
            receipt_number=receipt_number,
            keyword=keyword,
        )
        count = await self._session.scalar(
            select(func.count())
            .select_from(Payment)
            .join(Billable, Payment.billable_id == Billable.id)
            .where(*where)
        )
        return count or 0

    @typecheck
    async def next_receipt_seq(self, billable_id: uuid_str) -> int:
        # NOTE 동시성: count+1 은 같은 billable 에 동시 결제 시 같은 seq 를 줄 수 있다.
        # receipt_number 에 unique 제약이 없어 크래시는 없으나 영수증 번호가 중복될 수 있음.
        # 엄격 유일성이 필요하면 billable 행 잠금(SELECT…FOR UPDATE) 또는 per-billable
        # 시퀀스로 직렬화해야 한다(별도 결정 필요).
        return await self._count(where=[Payment.billable_id == billable_id]) + 1
