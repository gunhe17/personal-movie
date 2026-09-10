from sqlalchemy import extract, select

from app.core.datetime_utils import utc_now
from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import SubscriptionHistory


class SubscriptionHistoryRepository(PostgresRepository[SubscriptionHistory]):
    model = SubscriptionHistory

    # #
    # command

    @typecheck
    async def add_for_subscription(
        self,
        subscription_id: uuid_str,
        to_plan: str,
        actor_type: str,
        reason: str,
        changed_at: utc_dt,
        from_plan: str | None = None,
        from_status: str | None = None,
        to_status: str | None = None,
    ) -> SubscriptionHistory:
        return await super().add(
            SubscriptionHistory(
                subscription_id=subscription_id,
                from_plan=from_plan,
                to_plan=to_plan,
                actor_type=actor_type,
                reason=reason,
                changed_at=changed_at,
                from_status=from_status,
                to_status=to_status,
            )
        )

    # #
    # query

    @typecheck
    async def list_by_subscription(
        self,
        subscription_id: uuid_str,
        *,
        limit: int = 20,
    ) -> list[SubscriptionHistory]:
        stmt = (
            select(SubscriptionHistory)
            .where(
                SubscriptionHistory.subscription_id == subscription_id,
                SubscriptionHistory.deleted_at.is_(None),
            )
            .order_by(SubscriptionHistory.changed_at.desc())
            .limit(limit)
        )
        return await self._scalars(stmt)

    @typecheck
    async def count_churned_this_month_all_centers(self) -> int:
        now = utc_now()
        return await self._count(
            where=[
                SubscriptionHistory.to_status.in_(["expired", "cancelled"]),
                extract("year", SubscriptionHistory.changed_at) == now.year,
                extract("month", SubscriptionHistory.changed_at) == now.month,
            ]
        )
