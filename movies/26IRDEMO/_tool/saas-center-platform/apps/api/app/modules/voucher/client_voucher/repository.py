from datetime import date, datetime, time

from sqlalchemy import func, select

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import Page, PostgresRepository
from app.modules.voucher.client_voucher.models import ClientVoucher


class ClientVoucherRepository(PostgresRepository[ClientVoucher]):
    model = ClientVoucher

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        center_voucher_id: uuid_str,
        total_sessions: int,
        remaining_sessions: int,
        created_by: uuid_str,
        total_amount: int | None = None,
        remaining_amount: int | None = None,
        valid_from: date | None = None,
        valid_until: date | None = None,
    ) -> ClientVoucher:
        return await super().add(
            ClientVoucher(
                center_id=center_id,
                client_id=client_id,
                center_voucher_id=center_voucher_id,
                total_sessions=total_sessions,
                remaining_sessions=remaining_sessions,
                created_by=created_by,
                total_amount=total_amount,
                remaining_amount=remaining_amount,
                valid_from=valid_from,
                valid_until=valid_until,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        client_voucher_id: uuid_str,
        center_id: uuid_str,
        *,
        total_sessions: int = unset,
        remaining_sessions: int = unset,
        total_amount: int | None = unset,
        remaining_amount: int | None = unset,
        valid_from: date | None = unset,
        valid_until: date | None = unset,
    ) -> ClientVoucher:
        record = await self.get_by_id(client_voucher_id)
        if record.center_id != center_id:
            raise EntityNotFoundException(f"ClientVoucher not found: {client_voucher_id}")
        updated = await self.update_fields(
            client_voucher_id,
            total_sessions=total_sessions,
            remaining_sessions=remaining_sessions,
            total_amount=total_amount,
            remaining_amount=remaining_amount,
            valid_from=valid_from,
            valid_until=valid_until,
        )
        assert updated is not None
        return updated

    @typecheck
    async def remove_in_center(
        self,
        client_voucher_id: uuid_str,
        center_id: uuid_str,
    ) -> ClientVoucher | None:
        owned = await self._find(
            where=[
                ClientVoucher.id == client_voucher_id,
                ClientVoucher.center_id == center_id,
            ]
        )
        if owned is None:
            return None
        return await super().remove_by_id(client_voucher_id)

    # #
    # query

    @typecheck
    async def get_for_update(
        self,
        client_voucher_id: uuid_str,
        center_id: uuid_str,
    ) -> ClientVoucher:
        record = await self._find(
            where=[
                ClientVoucher.id == client_voucher_id,
                ClientVoucher.center_id == center_id,
            ],
            for_update=True,
        )
        if record is None:
            raise EntityNotFoundException(
                f"ClientVoucher not found: {client_voucher_id}"
            )
        return record

    @typecheck
    async def list_by_client(
        self,
        client_id: uuid_str,
        center_id: uuid_str,
    ) -> list[ClientVoucher]:
        return await self._filter(
            where=[
                ClientVoucher.client_id == client_id,
                ClientVoucher.center_id == center_id,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_center_voucher(
        self,
        center_voucher_id: uuid_str,
    ) -> list[ClientVoucher]:
        stmt = (
            select(ClientVoucher)
            .where(
                ClientVoucher.center_voucher_id == center_voucher_id,
                ClientVoucher.deleted_at.is_(None),
                ClientVoucher.remaining_sessions > 0,
            )
            .order_by(
                ClientVoucher.remaining_sessions.desc(),
                ClientVoucher.valid_until.asc().nullslast(),
            )
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_by_center_with_page(
        self,
        center_id: uuid_str,
        *,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[ClientVoucher], Page]:
        return await self._page(
            where=[ClientVoucher.center_id == center_id],
            page=page,
            size=size,
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_center(
        self,
        center_id: uuid_str,
        *,
        limit: int | None = None,
    ) -> list[ClientVoucher]:
        return await self._filter(
            where=[ClientVoucher.center_id == center_id],
            order_by="created_at",
            descending=True,
            limit=limit,
        )

    @typecheck
    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        client_id: str | None = None,
        client_ids: list[str] | None = None,
        center_voucher_id: str | None = None,
        center_voucher_ids: list[str] | None = None,
        total_sessions_min: int | None = None,
        total_sessions_max: int | None = None,
        remaining_sessions_min: int | None = None,
        remaining_sessions_max: int | None = None,
        total_amount_min: int | None = None,
        total_amount_max: int | None = None,
        remaining_amount_min: int | None = None,
        remaining_amount_max: int | None = None,
        valid_until_from: date | None = None,
        valid_until_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list:
        where = [
            ClientVoucher.center_id == center_id,
            ClientVoucher.deleted_at.is_(None),
        ]
        if ids:
            where.append(ClientVoucher.id.in_(ids))
        cid_set = set(client_ids or [])
        if client_id:
            cid_set.add(client_id)
        if cid_set:
            where.append(ClientVoucher.client_id.in_(cid_set))
        cvid_set = set(center_voucher_ids or [])
        if center_voucher_id:
            cvid_set.add(center_voucher_id)
        if cvid_set:
            where.append(ClientVoucher.center_voucher_id.in_(cvid_set))
        if total_sessions_min is not None:
            where.append(ClientVoucher.total_sessions >= total_sessions_min)
        if total_sessions_max is not None:
            where.append(ClientVoucher.total_sessions <= total_sessions_max)
        if remaining_sessions_min is not None:
            where.append(ClientVoucher.remaining_sessions >= remaining_sessions_min)
        if remaining_sessions_max is not None:
            where.append(ClientVoucher.remaining_sessions <= remaining_sessions_max)
        if total_amount_min is not None:
            where.append(ClientVoucher.total_amount >= total_amount_min)
        if total_amount_max is not None:
            where.append(ClientVoucher.total_amount <= total_amount_max)
        if remaining_amount_min is not None:
            where.append(ClientVoucher.remaining_amount >= remaining_amount_min)
        if remaining_amount_max is not None:
            where.append(ClientVoucher.remaining_amount <= remaining_amount_max)
        if valid_until_from or valid_until_to:
            where.append(ClientVoucher.valid_until.is_not(None))
            if valid_until_from:
                where.append(ClientVoucher.valid_until >= valid_until_from)
            if valid_until_to:
                where.append(ClientVoucher.valid_until <= valid_until_to)
        if date_from:
            where.append(ClientVoucher.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(ClientVoucher.created_at <= datetime.combine(date_to, time.max))
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        ids: list[str] | None = None,
        client_id: str | None = None,
        client_ids: list[str] | None = None,
        center_voucher_id: str | None = None,
        center_voucher_ids: list[str] | None = None,
        total_sessions_min: int | None = None,
        total_sessions_max: int | None = None,
        remaining_sessions_min: int | None = None,
        remaining_sessions_max: int | None = None,
        total_amount_min: int | None = None,
        total_amount_max: int | None = None,
        remaining_amount_min: int | None = None,
        remaining_amount_max: int | None = None,
        valid_until_from: date | None = None,
        valid_until_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[ClientVoucher]:
        where = self._agent_where(
            center_id,
            ids=ids,
            client_id=client_id,
            client_ids=client_ids,
            center_voucher_id=center_voucher_id,
            center_voucher_ids=center_voucher_ids,
            total_sessions_min=total_sessions_min,
            total_sessions_max=total_sessions_max,
            remaining_sessions_min=remaining_sessions_min,
            remaining_sessions_max=remaining_sessions_max,
            total_amount_min=total_amount_min,
            total_amount_max=total_amount_max,
            remaining_amount_min=remaining_amount_min,
            remaining_amount_max=remaining_amount_max,
            valid_until_from=valid_until_from,
            valid_until_to=valid_until_to,
            date_from=date_from,
            date_to=date_to,
        )
        col, descending = resolve_sort(
            sort,
            columns=frozenset({
                "total_sessions", "remaining_sessions",
                "total_amount", "remaining_amount",
            }),
            event_columns={"valid_until": "valid_until"},
        )
        order_col = getattr(ClientVoucher, col)
        order = order_col.desc() if descending else order_col.asc()
        rows = await self._session.execute(
            select(ClientVoucher).where(*where).order_by(order).limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        client_id: str | None = None,
        client_ids: list[str] | None = None,
        center_voucher_id: str | None = None,
        center_voucher_ids: list[str] | None = None,
        total_sessions_min: int | None = None,
        total_sessions_max: int | None = None,
        remaining_sessions_min: int | None = None,
        remaining_sessions_max: int | None = None,
        total_amount_min: int | None = None,
        total_amount_max: int | None = None,
        remaining_amount_min: int | None = None,
        remaining_amount_max: int | None = None,
        valid_until_from: date | None = None,
        valid_until_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> int:
        where = self._agent_where(
            center_id,
            ids=ids,
            client_id=client_id,
            client_ids=client_ids,
            center_voucher_id=center_voucher_id,
            center_voucher_ids=center_voucher_ids,
            total_sessions_min=total_sessions_min,
            total_sessions_max=total_sessions_max,
            remaining_sessions_min=remaining_sessions_min,
            remaining_sessions_max=remaining_sessions_max,
            total_amount_min=total_amount_min,
            total_amount_max=total_amount_max,
            remaining_amount_min=remaining_amount_min,
            remaining_amount_max=remaining_amount_max,
            valid_until_from=valid_until_from,
            valid_until_to=valid_until_to,
            date_from=date_from,
            date_to=date_to,
        )
        count = await self._session.scalar(
            select(func.count()).select_from(ClientVoucher).where(*where)
        )
        return count or 0
