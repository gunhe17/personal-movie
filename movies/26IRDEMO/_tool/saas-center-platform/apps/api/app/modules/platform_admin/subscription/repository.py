from math import ceil

from sqlalchemy import func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.new_repository import Page
from app.modules.center.center.models import Center
from app.modules.llm.credit_balance.models import CreditBalance
from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.plan_config import PaymentStatus
from app.modules.subscription.subscription_payment.models import SubscriptionPayment


class AdminSubscriptionRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_all_with_credit_with_page(
        self,
        *,
        plan: str | None = None,
        status: str | None = None,
        search: str | None = None,
        has_scheduled_downgrade: bool | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[dict], int]:
        base_where = [Subscription.deleted_at.is_(None)]
        if plan:
            base_where.append(Subscription.plan == plan)
        if status:
            base_where.append(Subscription.status == status)
        if search:
            base_where.append(Center.name.ilike(f"%{search}%"))
        if has_scheduled_downgrade is True:
            base_where.append(Subscription.reserved_plan.isnot(None))
        elif has_scheduled_downgrade is False:
            base_where.append(Subscription.reserved_plan.is_(None))

        stmt = (
            select(
                Subscription.id,
                Subscription.center_id,
                func.coalesce(Center.name, literal_column("'알 수 없음'")).label("center_name"),
                Subscription.plan,
                Subscription.status,
                func.coalesce(CreditBalance.credit_used, 0).label("credit_used"),
                func.coalesce(CreditBalance.credit_limit, 0).label("credit_limit"),
                Subscription.current_period_start,
                Subscription.current_period_end,
                Subscription.is_quota_exceeded,
                Subscription.reserved_plan,
                Subscription.reserved_at,
            )
            .outerjoin(Center, (Center.id == Subscription.center_id) & Center.deleted_at.is_(None))
            .outerjoin(
                CreditBalance,
                (CreditBalance.center_id == Subscription.center_id)
                & CreditBalance.deleted_at.is_(None),
            )
            .where(*base_where)
            .order_by(Subscription.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self._session.execute(stmt)
        rows = [row._asdict() for row in result.all()]

        count_stmt = (
            select(func.count(Subscription.id))
            .outerjoin(Center, (Center.id == Subscription.center_id) & Center.deleted_at.is_(None))
            .where(*base_where)
        )
        total = (await self._session.execute(count_stmt)).scalar_one()
        return rows, total

    async def list_failed_with_center_with_page(
        self,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[dict], Page]:
        base_where = [
            SubscriptionPayment.deleted_at.is_(None),
            SubscriptionPayment.status == PaymentStatus.FAILED,
        ]
        stmt = (
            select(
                SubscriptionPayment.id,
                SubscriptionPayment.center_id,
                func.coalesce(Center.name, literal_column("'알 수 없음'")).label("center_name"),
                SubscriptionPayment.plan,
                SubscriptionPayment.amount,
                SubscriptionPayment.failed_reason,
                SubscriptionPayment.created_at,
            )
            .outerjoin(
                Center,
                (Center.id == SubscriptionPayment.center_id) & Center.deleted_at.is_(None),
            )
            .where(*base_where)
            .order_by(SubscriptionPayment.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self._session.execute(stmt)
        rows = [row._asdict() for row in result.all()]

        count_stmt = select(func.count(SubscriptionPayment.id)).where(*base_where)
        total = (await self._session.execute(count_stmt)).scalar_one()
        return rows, Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )
