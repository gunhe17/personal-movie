from datetime import date, datetime, time, timedelta
from math import ceil

from sqlalchemy import case, distinct, func, literal, or_, select

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import Page, PostgresRepository
from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.voucher.models import Voucher


class CenterVoucherRepository(PostgresRepository[CenterVoucher]):
    model = CenterVoucher

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        catalog_id: uuid_str,
        created_by: uuid_str,
        unit_price: int | None = None,
        default_total_sessions: int | None = None,
        is_active: bool = True,
        memo: str | None = None,
    ) -> CenterVoucher:
        return await super().add(
            CenterVoucher(
                center_id=center_id,
                catalog_id=catalog_id,
                created_by=created_by,
                unit_price=unit_price,
                default_total_sessions=default_total_sessions,
                is_active=is_active,
                memo=memo,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        center_voucher_id: uuid_str,
        center_id: uuid_str,
        *,
        unit_price: int | None = unset,
        default_total_sessions: int | None = unset,
        is_active: bool = unset,
        memo: str | None = unset,
    ) -> CenterVoucher:
        record = await self.get_by_id(center_voucher_id)
        if record.center_id != center_id:
            raise EntityNotFoundException(f"CenterVoucher not found: {center_voucher_id}")
        updated = await self.update_fields(
            center_voucher_id,
            unit_price=unit_price,
            default_total_sessions=default_total_sessions,
            is_active=is_active,
            memo=memo,
        )
        assert updated is not None
        return updated

    @typecheck
    async def remove_in_center(
        self,
        center_voucher_id: uuid_str,
        center_id: uuid_str,
    ) -> CenterVoucher | None:
        owned = await self._find(
            where=[
                CenterVoucher.id == center_voucher_id,
                CenterVoucher.center_id == center_id,
            ]
        )
        if owned is None:
            return None
        return await super().remove_by_id(center_voucher_id)

    # #
    # query

    @typecheck
    async def find_by_catalog_id(
        self,
        center_id: uuid_str,
        catalog_id: uuid_str,
    ) -> CenterVoucher | None:
        return await self._find(
            where=[
                CenterVoucher.center_id == center_id,
                CenterVoucher.catalog_id == catalog_id,
            ]
        )

    @typecheck
    async def list_center_vouchers_with_page(
        self,
        center_id: uuid_str,
        is_active: bool | None = None,
        *,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[CenterVoucher], Page]:
        today = date.today()
        conditions = [
            CenterVoucher.center_id == center_id,
            CenterVoucher.deleted_at.is_(None),
        ]
        if is_active is not None:
            conditions.append(CenterVoucher.is_active.is_(is_active))

        total = await self._session.scalar(
            select(func.count()).select_from(CenterVoucher).where(*conditions)
        )
        total = total or 0

        valid_until_ok = or_(
            ClientVoucher.valid_until.is_(None),
            ClientVoucher.valid_until >= today,
        )
        client_count_subq = (
            select(
                ClientVoucher.center_voucher_id.label("cv_id"),
                func.count(distinct(ClientVoucher.client_id)).label("client_count"),
            )
            .where(
                ClientVoucher.deleted_at.is_(None),
                ClientVoucher.remaining_sessions > 0,
                valid_until_ok,
            )
            .group_by(ClientVoucher.center_voucher_id)
            .subquery()
        )

        client_count_col = func.coalesce(client_count_subq.c.client_count, 0)
        is_expired_col = case(
            (Voucher.usage_end_date.is_not(None) & (Voucher.usage_end_date < today), literal(True)),
            else_=literal(False),
        )
        group_rank_col = case(
            (is_expired_col.is_(True), literal(2)),
            (CenterVoucher.is_active.is_(False), literal(1)),
            else_=literal(0),
        )

        offset = (page - 1) * size
        stmt = (
            select(CenterVoucher)
            .outerjoin(Voucher, Voucher.id == CenterVoucher.catalog_id)
            .outerjoin(
                client_count_subq,
                client_count_subq.c.cv_id == CenterVoucher.id,
            )
            .where(*conditions)
            .order_by(
                group_rank_col.asc(),
                client_count_col.desc(),
                Voucher.name.asc(),
                CenterVoucher.created_at.desc(),
            )
            .offset(offset)
            .limit(size)
        )
        rows = await self._scalars(stmt)
        return rows, Page(total=total, page=page, size=size, pages=ceil(total / size) if size else 0)

    @typecheck
    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        catalog_id: str | None = None,
        catalog_ids: list[str] | None = None,
        unit_price_min: int | None = None,
        unit_price_max: int | None = None,
        default_total_sessions_min: int | None = None,
        default_total_sessions_max: int | None = None,
        is_active: bool | None = None,
        keyword: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list:
        where = [
            CenterVoucher.center_id == center_id,
            CenterVoucher.deleted_at.is_(None),
        ]
        if ids:
            where.append(CenterVoucher.id.in_(ids))
        cat_set = set(catalog_ids or [])
        if catalog_id:
            cat_set.add(catalog_id)
        if cat_set:
            where.append(CenterVoucher.catalog_id.in_(cat_set))
        if unit_price_min is not None:
            where.append(CenterVoucher.unit_price >= unit_price_min)
        if unit_price_max is not None:
            where.append(CenterVoucher.unit_price <= unit_price_max)
        if default_total_sessions_min is not None:
            where.append(CenterVoucher.default_total_sessions >= default_total_sessions_min)
        if default_total_sessions_max is not None:
            where.append(CenterVoucher.default_total_sessions <= default_total_sessions_max)
        if is_active is not None:
            where.append(CenterVoucher.is_active.is_(is_active))
        if keyword:
            where.append(CenterVoucher.memo.ilike(f"%{keyword}%"))
        if date_from:
            where.append(CenterVoucher.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(CenterVoucher.created_at <= datetime.combine(date_to, time.max))
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        ids: list[str] | None = None,
        catalog_id: str | None = None,
        catalog_ids: list[str] | None = None,
        unit_price_min: int | None = None,
        unit_price_max: int | None = None,
        default_total_sessions_min: int | None = None,
        default_total_sessions_max: int | None = None,
        is_active: bool | None = None,
        keyword: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[CenterVoucher]:
        where = self._agent_where(
            center_id,
            ids=ids,
            catalog_id=catalog_id,
            catalog_ids=catalog_ids,
            unit_price_min=unit_price_min,
            unit_price_max=unit_price_max,
            default_total_sessions_min=default_total_sessions_min,
            default_total_sessions_max=default_total_sessions_max,
            is_active=is_active,
            keyword=keyword,
            date_from=date_from,
            date_to=date_to,
        )
        col, descending = resolve_sort(
            sort, columns=frozenset({"unit_price", "default_total_sessions"})
        )
        order_col = getattr(CenterVoucher, col)
        order = order_col.desc() if descending else order_col.asc()
        rows = await self._session.execute(
            select(CenterVoucher).where(*where).order_by(order).limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        catalog_id: str | None = None,
        catalog_ids: list[str] | None = None,
        unit_price_min: int | None = None,
        unit_price_max: int | None = None,
        default_total_sessions_min: int | None = None,
        default_total_sessions_max: int | None = None,
        is_active: bool | None = None,
        keyword: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> int:
        where = self._agent_where(
            center_id,
            ids=ids,
            catalog_id=catalog_id,
            catalog_ids=catalog_ids,
            unit_price_min=unit_price_min,
            unit_price_max=unit_price_max,
            default_total_sessions_min=default_total_sessions_min,
            default_total_sessions_max=default_total_sessions_max,
            is_active=is_active,
            keyword=keyword,
            date_from=date_from,
            date_to=date_to,
        )
        count = await self._session.scalar(
            select(func.count()).select_from(CenterVoucher).where(*where)
        )
        return count or 0

    @typecheck
    async def get_voucher_stats(
        self,
        center_id: uuid_str,
        today: date,
        *,
        expiring_window_days: int = 60,
    ) -> dict:
        cv_conditions = [
            CenterVoucher.center_id == center_id,
            CenterVoucher.deleted_at.is_(None),
        ]

        active_count = await self._session.scalar(
            select(func.count())
            .select_from(CenterVoucher)
            .where(*cv_conditions, CenterVoucher.is_active.is_(True))
        )
        total_count = await self._session.scalar(
            select(func.count()).select_from(CenterVoucher).where(*cv_conditions)
        )

        valid_until_ok = or_(
            ClientVoucher.valid_until.is_(None),
            ClientVoucher.valid_until >= today,
        )
        in_progress_cv = (
            select(ClientVoucher)
            .join(
                CenterVoucher,
                CenterVoucher.id == ClientVoucher.center_voucher_id,
            )
            .where(
                *cv_conditions,
                ClientVoucher.deleted_at.is_(None),
                ClientVoucher.remaining_sessions > 0,
                valid_until_ok,
            )
            .subquery()
        )
        active_client_voucher_count = await self._session.scalar(
            select(func.count()).select_from(in_progress_cv)
        )

        expiring_until = today + timedelta(days=expiring_window_days)
        expiring_count = await self._session.scalar(
            select(func.count())
            .select_from(ClientVoucher)
            .join(
                CenterVoucher,
                CenterVoucher.id == ClientVoucher.center_voucher_id,
            )
            .where(
                *cv_conditions,
                ClientVoucher.deleted_at.is_(None),
                ClientVoucher.remaining_sessions > 0,
                ClientVoucher.valid_until.is_not(None),
                ClientVoucher.valid_until >= today,
                ClientVoucher.valid_until <= expiring_until,
            )
        )

        per_voucher_stmt = (
            select(
                ClientVoucher.center_voucher_id,
                func.count(distinct(ClientVoucher.client_id)).label("client_count"),
            )
            .join(
                CenterVoucher,
                CenterVoucher.id == ClientVoucher.center_voucher_id,
            )
            .where(
                *cv_conditions,
                ClientVoucher.deleted_at.is_(None),
                ClientVoucher.remaining_sessions > 0,
                valid_until_ok,
            )
            .group_by(ClientVoucher.center_voucher_id)
        )
        per_voucher_rows = (await self._session.execute(per_voucher_stmt)).all()
        per_voucher = [
            {
                "center_voucher_id": row.center_voucher_id,
                "active_client_count": row.client_count,
            }
            for row in per_voucher_rows
        ]

        return {
            "active_count": active_count or 0,
            "total_count": total_count or 0,
            "active_client_voucher_count": active_client_voucher_count or 0,
            "expiring_within_days_count": expiring_count or 0,
            "expiring_window_days": expiring_window_days,
            "per_voucher": per_voucher,
        }
