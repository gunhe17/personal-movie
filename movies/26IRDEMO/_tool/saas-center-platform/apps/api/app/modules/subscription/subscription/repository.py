from datetime import date, datetime, time, timedelta

from sqlalchemy import and_, func, or_, select

from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Subscription


class SubscriptionRepository(PostgresRepository[Subscription]):
    model = Subscription

    # #
    # command

    @typecheck
    async def add_in_center(
        self,
        center_id: uuid_str,
        plan: str,
        status: str,
        current_period_start: utc_dt,
        current_period_end: utc_dt,
        trial_end: utc_dt | None = None,
    ) -> Subscription:
        return await super().add(
            Subscription(
                center_id=center_id,
                plan=plan,
                status=status,
                current_period_start=current_period_start,
                current_period_end=current_period_end,
                trial_end=trial_end,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        subscription_id: uuid_str,
        center_id: uuid_str,
        *,
        plan: str = unset,
        status: str = unset,
        current_period_start: utc_dt = unset,
        current_period_end: utc_dt = unset,
        trial_end: utc_dt | None = unset,
        cancelled_at: utc_dt | None = unset,
        is_quota_exceeded: bool = unset,
        quota_grace_end: utc_dt | None = unset,
        reserved_plan: str | None = unset,
        reserved_at: utc_dt | None = unset,
    ) -> Subscription:
        sub = await self.get_by_id(subscription_id)
        if sub.center_id != center_id:
            raise EntityNotFoundException(f"Subscription not found: {subscription_id}")
        updated = await self.update_fields(
            subscription_id,
            plan=plan,
            status=status,
            current_period_start=current_period_start,
            current_period_end=current_period_end,
            trial_end=trial_end,
            cancelled_at=cancelled_at,
            is_quota_exceeded=is_quota_exceeded,
            quota_grace_end=quota_grace_end,
            reserved_plan=reserved_plan,
            reserved_at=reserved_at,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def find_in_center(self, center_id: uuid_str) -> Subscription | None:
        return await self._find(where=[Subscription.center_id == center_id])

    @typecheck
    async def get_in_center(self, center_id: uuid_str) -> Subscription:
        sub = await self.find_in_center(center_id=center_id)
        if sub is None:
            raise EntityNotFoundException(f"구독을 찾을 수 없습니다: center={center_id}")
        return sub

    @typecheck
    async def find_in_center_for_update(
        self,
        center_id: uuid_str,
    ) -> Subscription | None:
        return await self._find(
            where=[Subscription.center_id == center_id],
            for_update=True,
        )

    @typecheck
    async def get_in_center_for_update(
        self,
        center_id: uuid_str,
    ) -> Subscription:
        sub = await self.find_in_center_for_update(center_id=center_id)
        if sub is None:
            raise EntityNotFoundException(f"구독을 찾을 수 없습니다: center={center_id}")
        return sub

    @typecheck
    async def list_expired_with_reservation_all_centers(self) -> list[Subscription]:
        return await self._filter(
            where=[
                Subscription.current_period_end < utc_now(),
                Subscription.reserved_plan.isnot(None),
            ]
        )


    @typecheck
    async def list_roll_candidates_all_centers(self) -> list[Subscription]:
        # 기간 경계 정산 후보(예약 다운그레이드·미납 만료·체험 만료 상위집합).
        # roll_center_period_handler가 실제 도래 여부를 재판정하므로 상위집합이면 충분.
        now = utc_now()
        return await self._filter(
            where=[
                or_(
                    Subscription.current_period_end < now,
                    and_(
                        Subscription.status == "trial",
                        Subscription.trial_end.isnot(None),
                        Subscription.trial_end < now,
                    ),
                )
            ]
        )

    @typecheck
    async def list_expired_quota_grace_all_centers(self) -> list[Subscription]:
        now = utc_now()
        return await self._filter(
            where=[
                Subscription.is_quota_exceeded.is_(True),
                Subscription.quota_grace_end.isnot(None),
                Subscription.quota_grace_end < now,
            ]
        )

    @typecheck
    async def list_stale_payment_states_all_centers(
        self,
        *,
        stale_days: int = 7,
    ) -> list[Subscription]:
        cutoff = utc_now() - timedelta(days=stale_days)
        return await self._filter(
            where=[
                Subscription.status.in_(["pending_payment", "payment_failed"]),
                Subscription.updated_at < cutoff,
            ]
        )

    @typecheck
    async def count_scheduled_downgrades_all_centers(self) -> int:
        return await self._count(where=[Subscription.reserved_plan.isnot(None)])

    @typecheck
    async def count_quota_exceeded_all_centers(self) -> int:
        return await self._count(where=[Subscription.is_quota_exceeded.is_(True)])

    @typecheck
    async def aggregate_plan_distribution_all_centers(self) -> dict[str, int]:
        stmt = (
            select(Subscription.plan, func.count(Subscription.id))
            .where(Subscription.deleted_at.is_(None))
            .group_by(Subscription.plan)
        )
        result = await self._session.execute(stmt)
        return dict(result.all())

    @typecheck
    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        plan: str | None = None,
        status: str | None = None,
        reserved_plan: str | None = None,
        is_quota_exceeded: bool | None = None,
        current_period_start_from: date | None = None,
        current_period_start_to: date | None = None,
        current_period_end_from: date | None = None,
        current_period_end_to: date | None = None,
        trial_end_from: date | None = None,
        trial_end_to: date | None = None,
        cancelled_from: date | None = None,
        cancelled_to: date | None = None,
        quota_grace_end_from: date | None = None,
        quota_grace_end_to: date | None = None,
        reserved_from: date | None = None,
        reserved_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list:
        where = [
            Subscription.center_id == center_id,
            Subscription.deleted_at.is_(None),
        ]
        if ids:
            where.append(Subscription.id.in_(ids))
        if plan:
            where.append(Subscription.plan == plan)
        if status:
            where.append(Subscription.status == status)
        if reserved_plan:
            where.append(Subscription.reserved_plan == reserved_plan)
        if is_quota_exceeded is not None:
            where.append(Subscription.is_quota_exceeded.is_(is_quota_exceeded))
        if current_period_start_from:
            where.append(Subscription.current_period_start >= datetime.combine(current_period_start_from, time.min))
        if current_period_start_to:
            where.append(Subscription.current_period_start <= datetime.combine(current_period_start_to, time.max))
        if current_period_end_from:
            where.append(Subscription.current_period_end >= datetime.combine(current_period_end_from, time.min))
        if current_period_end_to:
            where.append(Subscription.current_period_end <= datetime.combine(current_period_end_to, time.max))
        if trial_end_from:
            where.append(Subscription.trial_end >= datetime.combine(trial_end_from, time.min))
        if trial_end_to:
            where.append(Subscription.trial_end <= datetime.combine(trial_end_to, time.max))
        if cancelled_from:
            where.append(Subscription.cancelled_at >= datetime.combine(cancelled_from, time.min))
        if cancelled_to:
            where.append(Subscription.cancelled_at <= datetime.combine(cancelled_to, time.max))
        if quota_grace_end_from:
            where.append(Subscription.quota_grace_end >= datetime.combine(quota_grace_end_from, time.min))
        if quota_grace_end_to:
            where.append(Subscription.quota_grace_end <= datetime.combine(quota_grace_end_to, time.max))
        if reserved_from:
            where.append(Subscription.reserved_at >= datetime.combine(reserved_from, time.min))
        if reserved_to:
            where.append(Subscription.reserved_at <= datetime.combine(reserved_to, time.max))
        if date_from:
            where.append(Subscription.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(Subscription.created_at <= datetime.combine(date_to, time.max))
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        ids: list[str] | None = None,
        plan: str | None = None,
        status: str | None = None,
        reserved_plan: str | None = None,
        is_quota_exceeded: bool | None = None,
        current_period_start_from: date | None = None,
        current_period_start_to: date | None = None,
        current_period_end_from: date | None = None,
        current_period_end_to: date | None = None,
        trial_end_from: date | None = None,
        trial_end_to: date | None = None,
        cancelled_from: date | None = None,
        cancelled_to: date | None = None,
        quota_grace_end_from: date | None = None,
        quota_grace_end_to: date | None = None,
        reserved_from: date | None = None,
        reserved_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[Subscription]:
        where = self._agent_where(
            center_id,
            ids=ids,
            plan=plan,
            status=status,
            reserved_plan=reserved_plan,
            is_quota_exceeded=is_quota_exceeded,
            current_period_start_from=current_period_start_from,
            current_period_start_to=current_period_start_to,
            current_period_end_from=current_period_end_from,
            current_period_end_to=current_period_end_to,
            trial_end_from=trial_end_from,
            trial_end_to=trial_end_to,
            cancelled_from=cancelled_from,
            cancelled_to=cancelled_to,
            quota_grace_end_from=quota_grace_end_from,
            quota_grace_end_to=quota_grace_end_to,
            reserved_from=reserved_from,
            reserved_to=reserved_to,
            date_from=date_from,
            date_to=date_to,
        )
        col, descending = resolve_sort(
            sort,
            event_columns={
                "current_period_start": "current_period_start",
                "current_period_end": "current_period_end",
                "trial_end": "trial_end",
                "cancelled": "cancelled_at",
                "quota_grace_end": "quota_grace_end",
                "reserved": "reserved_at",
            },
        )
        order_col = getattr(Subscription, col)
        order = order_col.desc() if descending else order_col.asc()
        rows = await self._session.execute(
            select(Subscription).where(*where).order_by(order).limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        plan: str | None = None,
        status: str | None = None,
        reserved_plan: str | None = None,
        is_quota_exceeded: bool | None = None,
        current_period_start_from: date | None = None,
        current_period_start_to: date | None = None,
        current_period_end_from: date | None = None,
        current_period_end_to: date | None = None,
        trial_end_from: date | None = None,
        trial_end_to: date | None = None,
        cancelled_from: date | None = None,
        cancelled_to: date | None = None,
        quota_grace_end_from: date | None = None,
        quota_grace_end_to: date | None = None,
        reserved_from: date | None = None,
        reserved_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> int:
        where = self._agent_where(
            center_id,
            ids=ids,
            plan=plan,
            status=status,
            reserved_plan=reserved_plan,
            is_quota_exceeded=is_quota_exceeded,
            current_period_start_from=current_period_start_from,
            current_period_start_to=current_period_start_to,
            current_period_end_from=current_period_end_from,
            current_period_end_to=current_period_end_to,
            trial_end_from=trial_end_from,
            trial_end_to=trial_end_to,
            cancelled_from=cancelled_from,
            cancelled_to=cancelled_to,
            quota_grace_end_from=quota_grace_end_from,
            quota_grace_end_to=quota_grace_end_to,
            reserved_from=reserved_from,
            reserved_to=reserved_to,
            date_from=date_from,
            date_to=date_to,
        )
        count = await self._session.scalar(
            select(func.count()).select_from(Subscription).where(*where)
        )
        return count or 0
