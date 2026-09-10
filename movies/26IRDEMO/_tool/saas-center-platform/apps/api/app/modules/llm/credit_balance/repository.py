from datetime import date, datetime, time

from sqlalchemy import func, select

from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CreditBalance


class CreditBalanceRepository(PostgresRepository[CreditBalance]):
    model = CreditBalance

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        plan_type: str,
        credit_limit: int,
        credit_used: int,
        period_start: utc_dt,
        period_end: utc_dt,
    ) -> CreditBalance:
        return await super().add(
            CreditBalance(
                center_id=center_id,
                plan_type=plan_type,
                credit_limit=credit_limit,
                credit_used=credit_used,
                period_start=period_start,
                period_end=period_end,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        credit_used: int = unset,
        credit_limit: int = unset,
    ) -> CreditBalance | None:
        return await self.update_fields(
            id,
            credit_used=credit_used,
            credit_limit=credit_limit,
        )

    @typecheck
    async def increment_credit_limit(
        self,
        id: uuid_str,
        *,
        amount: int,
    ) -> CreditBalance | None:
        from sqlalchemy import update

        stmt = (
            update(CreditBalance)
            .where(CreditBalance.id == id, CreditBalance.deleted_at.is_(None))
            .values(credit_limit=CreditBalance.credit_limit + amount)
            .returning(CreditBalance)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    @typecheck
    async def remove_by_center(self, center_id: uuid_str) -> list[CreditBalance]:
        from sqlalchemy import update

        stmt = (
            update(CreditBalance)
            .where(
                CreditBalance.deleted_at.is_(None), CreditBalance.center_id == center_id
            )
            .values(deleted_at=func.now())
            .returning(CreditBalance)
        )
        rows = list((await self._session.execute(stmt)).scalars())
        await self._session.flush()
        return rows

    # #
    # query

    @typecheck
    async def find_active_by_center(self, center_id: uuid_str) -> CreditBalance | None:
        return await self._find(
            where=[
                CreditBalance.center_id == center_id,
                CreditBalance.period_end > func.now(),
            ],
            order_by="period_start",
            descending=True,
        )

    @typecheck
    async def find_active_for_update(self, center_id: uuid_str) -> CreditBalance | None:
        return await self._find(
            where=[
                CreditBalance.center_id == center_id,
                CreditBalance.period_end > func.now(),
            ],
            order_by="period_start",
            descending=True,
            for_update=True,
        )

    @typecheck
    async def find_latest_expired(self, center_id: uuid_str) -> CreditBalance | None:
        return await self._find(
            where=[CreditBalance.center_id == center_id],
            order_by="period_start",
            descending=True,
        )

    @typecheck
    async def find_last_consumed_including_deleted(
        self,
        center_id: uuid_str,
    ) -> CreditBalance | None:
        # 만료 헤드라인용 — soft-delete 포함, 실제 소비한(used>0) 마지막 기간 우선 후 최근순.
        # 롤오버로 삭제된 직전 기간·만료로 삭제된 phantom 모두 후보에 넣되 소비분을 앞세운다.
        stmt = (
            select(CreditBalance)
            .where(CreditBalance.center_id == center_id)
            .order_by(
                (CreditBalance.credit_used > 0).desc(),
                CreditBalance.period_start.desc(),
            )
            .limit(1)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    # #
    # agent query — v2 공유 WHERE (행/집계 동일 절)

    @typecheck
    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        plan_type: str | None = None,
        credit_limit_min: int | None = None,
        credit_limit_max: int | None = None,
        credit_used_min: int | None = None,
        credit_used_max: int | None = None,
        period_start_from: date | None = None,
        period_start_to: date | None = None,
        period_end_from: date | None = None,
        period_end_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list:
        where = [
            CreditBalance.center_id == center_id,
            CreditBalance.deleted_at.is_(None),
        ]
        if ids:
            where.append(CreditBalance.id.in_(ids))
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
        if period_start_from:
            where.append(CreditBalance.period_start >= datetime.combine(period_start_from, time.min))
        if period_start_to:
            where.append(CreditBalance.period_start <= datetime.combine(period_start_to, time.max))
        if period_end_from:
            where.append(CreditBalance.period_end >= datetime.combine(period_end_from, time.min))
        if period_end_to:
            where.append(CreditBalance.period_end <= datetime.combine(period_end_to, time.max))
        if date_from:
            where.append(CreditBalance.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(CreditBalance.created_at <= datetime.combine(date_to, time.max))
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        ids: list[str] | None = None,
        plan_type: str | None = None,
        credit_limit_min: int | None = None,
        credit_limit_max: int | None = None,
        credit_used_min: int | None = None,
        credit_used_max: int | None = None,
        period_start_from: date | None = None,
        period_start_to: date | None = None,
        period_end_from: date | None = None,
        period_end_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[CreditBalance]:
        where = self._agent_where(
            center_id,
            ids=ids,
            plan_type=plan_type,
            credit_limit_min=credit_limit_min,
            credit_limit_max=credit_limit_max,
            credit_used_min=credit_used_min,
            credit_used_max=credit_used_max,
            period_start_from=period_start_from,
            period_start_to=period_start_to,
            period_end_from=period_end_from,
            period_end_to=period_end_to,
            date_from=date_from,
            date_to=date_to,
        )
        col, descending = resolve_sort(
            sort,
            columns=frozenset({"credit_limit", "credit_used"}),
            event_columns={"period_start": "period_start", "period_end": "period_end"},
        )
        order_col = getattr(CreditBalance, col)
        order = order_col.desc() if descending else order_col.asc()
        rows = await self._session.execute(
            select(CreditBalance).where(*where).order_by(order).limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        plan_type: str | None = None,
        credit_limit_min: int | None = None,
        credit_limit_max: int | None = None,
        credit_used_min: int | None = None,
        credit_used_max: int | None = None,
        period_start_from: date | None = None,
        period_start_to: date | None = None,
        period_end_from: date | None = None,
        period_end_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> int:
        where = self._agent_where(
            center_id,
            ids=ids,
            plan_type=plan_type,
            credit_limit_min=credit_limit_min,
            credit_limit_max=credit_limit_max,
            credit_used_min=credit_used_min,
            credit_used_max=credit_used_max,
            period_start_from=period_start_from,
            period_start_to=period_start_to,
            period_end_from=period_end_from,
            period_end_to=period_end_to,
            date_from=date_from,
            date_to=date_to,
        )
        count = await self._session.scalar(
            select(func.count()).select_from(CreditBalance).where(*where)
        )
        return count or 0

