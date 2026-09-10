from sqlalchemy import Integer, cast, extract, func, select

from app.modules.subscription.subscription.plan_config import PaymentStatus
from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import SubscriptionPayment


class SubscriptionPaymentRepository(PostgresRepository[SubscriptionPayment]):
    model = SubscriptionPayment

    # #
    # command

    @typecheck
    async def add_in_center(
        self,
        center_id: uuid_str,
        subscription_id: uuid_str,
        plan: str,
        amount: int,
        status: str,
        toss_order_id: str,
    ) -> SubscriptionPayment:
        return await super().add(
            SubscriptionPayment(
                center_id=center_id,
                subscription_id=subscription_id,
                plan=plan,
                amount=amount,
                status=status,
                toss_order_id=toss_order_id,
            )
        )

    @typecheck
    async def update_payment(
        self,
        payment_id: uuid_str,
        status: str = unset,
        toss_payment_key: str | None = unset,
        method: str | None = unset,
        paid_at: utc_dt | None = unset,
        failed_reason: str | None = unset,
        raw_response: str | None = unset,
    ) -> SubscriptionPayment | None:
        return await self.update_fields(
            payment_id,
            status=status,
            toss_payment_key=toss_payment_key,
            method=method,
            paid_at=paid_at,
            failed_reason=failed_reason,
            raw_response=raw_response,
        )

    # #
    # query

    @typecheck
    async def find_by_order_id(self, toss_order_id: str) -> SubscriptionPayment | None:
        return await self._find(where=[SubscriptionPayment.toss_order_id == toss_order_id])

    @typecheck
    async def get_by_order_id(self, toss_order_id: str) -> SubscriptionPayment:
        payment = await self.find_by_order_id(toss_order_id=toss_order_id)
        if payment is None:
            raise EntityNotFoundException(f"결제를 찾을 수 없습니다: order={toss_order_id}")
        return payment

    @typecheck
    async def find_for_update(self, payment_id: uuid_str) -> SubscriptionPayment | None:
        return await self._find(
            where=[SubscriptionPayment.id == payment_id],
            for_update=True,
        )

    @typecheck
    async def get_for_update(self, payment_id: uuid_str) -> SubscriptionPayment:
        payment = await self.find_for_update(payment_id=payment_id)
        if payment is None:
            raise EntityNotFoundException(f"결제를 찾을 수 없습니다: {payment_id}")
        return payment

    @typecheck
    async def list_in_center(
        self,
        center_id: uuid_str,
        *,
        limit: int = 20,
    ) -> list[SubscriptionPayment]:
        return await self._filter(
            where=[SubscriptionPayment.center_id == center_id],
            order_by="created_at",
            descending=True,
            limit=limit,
        )

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[SubscriptionPayment], Page]:
        return await self._page(
            where=[SubscriptionPayment.center_id == center_id],
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )

    @typecheck
    async def count_failed_all_centers(self) -> int:
        return await self._count(where=[SubscriptionPayment.status == PaymentStatus.FAILED])

    @typecheck
    async def aggregate_confirmed_amount_all_centers(self, *, year: int, month: int) -> int:
        stmt = (
            select(func.coalesce(func.sum(SubscriptionPayment.amount), 0))
            .where(
                SubscriptionPayment.deleted_at.is_(None),
                SubscriptionPayment.status == PaymentStatus.CONFIRMED,
                extract("year", SubscriptionPayment.paid_at) == year,
                extract("month", SubscriptionPayment.paid_at) == month,
            )
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    @typecheck
    async def aggregate_monthly_revenue_all_centers(self, *, months: int = 6) -> list[dict]:
        from dateutil.relativedelta import relativedelta

        start = utc_now() - relativedelta(months=months)
        stmt = (
            select(
                cast(extract("year", SubscriptionPayment.paid_at), Integer).label("year"),
                cast(extract("month", SubscriptionPayment.paid_at), Integer).label("month"),
                func.coalesce(func.sum(SubscriptionPayment.amount), 0).label("mrr"),
                func.count(SubscriptionPayment.id).label("confirmed_count"),
            )
            .where(
                SubscriptionPayment.deleted_at.is_(None),
                SubscriptionPayment.status == PaymentStatus.CONFIRMED,
                SubscriptionPayment.paid_at >= start,
            )
            .group_by("year", "month")
            .order_by("year", "month")
        )
        result = await self._session.execute(stmt)
        return [row._asdict() for row in result.all()]

    @typecheck
    async def aggregate_confirmed_by_plan_all_centers(
        self,
        *,
        year: int,
        month: int,
    ) -> dict[str, int]:
        stmt = (
            select(
                SubscriptionPayment.plan,
                func.coalesce(func.sum(SubscriptionPayment.amount), 0).label("total"),
            )
            .where(
                SubscriptionPayment.deleted_at.is_(None),
                SubscriptionPayment.status == PaymentStatus.CONFIRMED,
                extract("year", SubscriptionPayment.paid_at) == year,
                extract("month", SubscriptionPayment.paid_at) == month,
            )
            .group_by(SubscriptionPayment.plan)
        )
        result = await self._session.execute(stmt)
        return {row.plan: row.total for row in result.all()}
