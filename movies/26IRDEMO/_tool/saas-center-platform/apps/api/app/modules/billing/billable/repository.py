from datetime import date, datetime, time
from typing import Any

from sqlalchemy import func, select

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from ..billable_item.models import BillableItem
from .models import Billable


class BillableRepository(PostgresRepository[Billable]):
    model = Billable

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        billable_date: Any,
        status: str,
        created_by: uuid_str,
        total_amount: int = 0,
        discount_amount: int = 0,
        subsidy_amount: int = 0,
        paid_amount: int = 0,
        unpaid_amount: int = 0,
        issued_at: utc_dt | None = None,
        due_date: Any | None = None,
        memo: str | None = None,
    ) -> Billable:
        return await super().add(
            Billable(
                center_id=center_id,
                client_id=client_id,
                billable_date=billable_date,
                status=status,
                created_by=created_by,
                total_amount=total_amount,
                discount_amount=discount_amount,
                subsidy_amount=subsidy_amount,
                paid_amount=paid_amount,
                unpaid_amount=unpaid_amount,
                issued_at=issued_at,
                due_date=due_date,
                memo=memo,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        billable_id: uuid_str,
        center_id: uuid_str,
        *,
        billable_date: Any = unset,
        status: str = unset,
        total_amount: int = unset,
        discount_amount: int = unset,
        paid_amount: int = unset,
        unpaid_amount: int = unset,
        issued_at: utc_dt | None = unset,
        due_date: Any | None = unset,
        memo: str | None = unset,
    ) -> Billable | None:
        record = await self.find_in_center(
            billable_id=billable_id,
            center_id=center_id,
        )
        if record is None:
            return None
        return await self.update_fields(
            billable_id,
            billable_date=billable_date,
            status=status,
            total_amount=total_amount,
            discount_amount=discount_amount,
            paid_amount=paid_amount,
            unpaid_amount=unpaid_amount,
            issued_at=issued_at,
            due_date=due_date,
            memo=memo,
        )

    @typecheck
    async def remove_in_center(
        self,
        billable_id: uuid_str,
        center_id: uuid_str,
    ) -> None:
        record = await self.find_in_center(
            billable_id=billable_id,
            center_id=center_id,
        )
        if record is None:
            return
        await self.remove_by_id(billable_id)

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        billable_id: uuid_str,
        center_id: uuid_str,
    ) -> Billable | None:
        return await self._find(
            where=[
                Billable.id == billable_id,
                Billable.center_id == center_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        billable_id: uuid_str,
        center_id: uuid_str,
    ) -> Billable:
        record = await self.find_in_center(
            billable_id=billable_id,
            center_id=center_id,
        )
        if record is None:
            raise EntityNotFoundException(f"청구서를 찾을 수 없습니다: {billable_id}")
        return record

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        status: str | None = None,
        client_id: uuid_str | None = None,
        *,
        page: int = 1,
        size: int = 20,
        sort: str = "desc",
    ) -> tuple[list[Billable], Page]:
        conditions = [Billable.center_id == center_id]
        if status:
            conditions.append(Billable.status == status)
        if client_id:
            conditions.append(Billable.client_id == client_id)

        return await self._page(
            where=conditions,
            order_by="created_at",
            descending=(sort != "asc"),
            page=page,
            size=size,
        )

    @typecheck
    async def aggregate_unpaid_total_in_center(
        self,
        center_id: uuid_str,
        status: str | None = None,
        client_id: uuid_str | None = None,
    ) -> int:
        conditions = [
            Billable.center_id == center_id,
            Billable.deleted_at.is_(None),
        ]
        if status:
            conditions.append(Billable.status == status)
        if client_id:
            conditions.append(Billable.client_id == client_id)

        total = await self._session.scalar(
            select(func.coalesce(func.sum(Billable.unpaid_amount), 0)).where(*conditions)
        )
        return int(total or 0)

    @typecheck
    async def list_by_related(
        self,
        center_id: uuid_str,
        related_type: str | list[str],
        related_case_id: uuid_str | None = None,
        related_session_id: uuid_str | None = None,
    ) -> list[Billable]:
        types = [related_type] if isinstance(related_type, str) else list(related_type)
        if not types:
            return []

        conditions = [
            Billable.center_id == center_id,
            Billable.deleted_at.is_(None),
            BillableItem.deleted_at.is_(None),
            BillableItem.related_type.in_(types),
        ]
        if related_session_id:
            conditions.append(BillableItem.related_session_id == related_session_id)
        elif related_case_id:
            conditions.append(BillableItem.related_case_id == related_case_id)
        else:
            return []

        stmt = (
            select(Billable)
            .join(BillableItem, BillableItem.billable_id == Billable.id)
            .where(*conditions)
            .distinct()
            .order_by(Billable.created_at.desc())
        )
        return await self._scalars(stmt)

    @typecheck
    async def count_unpaid_by_related_case_ids(
        self,
        center_id: uuid_str,
        case_ids: list[str],
    ) -> int:
        if not case_ids:
            return 0
        count = await self._session.scalar(
            select(func.count(func.distinct(Billable.id)))
            .select_from(Billable)
            .join(BillableItem, BillableItem.billable_id == Billable.id)
            .where(
                Billable.center_id == center_id,
                Billable.deleted_at.is_(None),
                Billable.unpaid_amount > 0,
                BillableItem.deleted_at.is_(None),
                BillableItem.related_case_id.in_(case_ids),
            )
        )
        return int(count or 0)

    @typecheck
    async def exists_session_billing_for_case(
        self,
        center_id: uuid_str,
        related_case_id: uuid_str,
        case_related_type: str,
        client_id: uuid_str,
    ) -> bool:
        session_type = case_related_type.replace("_case", "_session")
        count = await self._session.scalar(
            select(func.count())
            .select_from(BillableItem)
            .join(Billable, BillableItem.billable_id == Billable.id)
            .where(
                Billable.center_id == center_id,
                Billable.client_id == client_id,
                Billable.deleted_at.is_(None),
                BillableItem.deleted_at.is_(None),
                BillableItem.related_case_id == related_case_id,
                BillableItem.related_type == session_type,
                BillableItem.related_session_id.is_not(None),
            )
        )
        return (count or 0) > 0

    @typecheck
    async def exists_billing_for_session(
        self,
        center_id: uuid_str,
        related_session_id: uuid_str,
        related_type: str,
        client_id: uuid_str,
    ) -> bool:
        count = await self._session.scalar(
            select(func.count())
            .select_from(BillableItem)
            .join(Billable, BillableItem.billable_id == Billable.id)
            .where(
                Billable.center_id == center_id,
                Billable.client_id == client_id,
                Billable.deleted_at.is_(None),
                BillableItem.deleted_at.is_(None),
                BillableItem.related_type == related_type,
                BillableItem.related_session_id == related_session_id,
            )
        )
        return (count or 0) > 0

    @typecheck
    async def exists_package_billing_for_case(
        self,
        center_id: uuid_str,
        related_case_id: uuid_str,
        case_related_type: str,
        client_id: uuid_str,
    ) -> bool:
        count = await self._session.scalar(
            select(func.count())
            .select_from(BillableItem)
            .join(Billable, BillableItem.billable_id == Billable.id)
            .where(
                Billable.center_id == center_id,
                Billable.client_id == client_id,
                Billable.deleted_at.is_(None),
                BillableItem.deleted_at.is_(None),
                BillableItem.related_case_id == related_case_id,
                BillableItem.related_type == case_related_type,
            )
        )
        return (count or 0) > 0

    @typecheck
    @typecheck
    async def list_by_ids(self, ids: list[str]) -> list[Billable]:
        if not ids:
            return []
        return await self._filter(where=[Billable.id.in_(ids)])

    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        status: str | None = None,
        ids: list[str] | None = None,
        client_id: str | None = None,
        client_ids: list[str] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        due_from: date | None = None,
        due_to: date | None = None,
        issued_from: date | None = None,
        issued_to: date | None = None,
        amount_min: int | None = None,
        amount_max: int | None = None,
        unpaid_amount_min: int | None = None,
        unpaid_amount_max: int | None = None,
        keyword: str | None = None,
    ) -> list:
        where = [
            Billable.center_id == center_id,
            Billable.deleted_at.is_(None),
        ]
        if status:
            where.append(Billable.status == status)
        if ids:
            where.append(Billable.id.in_(ids))
        cid_set = set(client_ids or [])
        if client_id:
            cid_set.add(client_id)
        if cid_set:
            where.append(Billable.client_id.in_(cid_set))
        if date_from:
            where.append(Billable.billable_date >= date_from)
        if date_to:
            where.append(Billable.billable_date <= date_to)
        if due_from or due_to:
            where.append(Billable.due_date.is_not(None))
            if due_from:
                where.append(Billable.due_date >= due_from)
            if due_to:
                where.append(Billable.due_date <= due_to)
        if issued_from or issued_to:
            where.append(Billable.issued_at.is_not(None))
            if issued_from:
                where.append(Billable.issued_at >= datetime.combine(issued_from, time.min))
            if issued_to:
                where.append(Billable.issued_at <= datetime.combine(issued_to, time.max))
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
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 200,
        status: str | None = None,
        ids: list[str] | None = None,
        client_id: str | None = None,
        client_ids: list[str] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        due_from: date | None = None,
        due_to: date | None = None,
        issued_from: date | None = None,
        issued_to: date | None = None,
        amount_min: int | None = None,
        amount_max: int | None = None,
        unpaid_amount_min: int | None = None,
        unpaid_amount_max: int | None = None,
        keyword: str | None = None,
    ) -> list[Billable]:
        where = self._agent_where(
            center_id,
            status=status,
            ids=ids,
            client_id=client_id,
            client_ids=client_ids,
            date_from=date_from,
            date_to=date_to,
            due_from=due_from,
            due_to=due_to,
            issued_from=issued_from,
            issued_to=issued_to,
            amount_min=amount_min,
            amount_max=amount_max,
            unpaid_amount_min=unpaid_amount_min,
            unpaid_amount_max=unpaid_amount_max,
            keyword=keyword,
        )
        col, descending = resolve_sort(
            sort,
            columns=frozenset({"total_amount", "unpaid_amount", "paid_amount"}),
            event_columns={"issued": "issued_at", "due": "due_date"},
        )
        order_col = getattr(Billable, col)
        order = order_col.desc() if descending else order_col.asc()
        rows = await self._session.execute(
            select(Billable).where(*where).order_by(order).limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        status: str | None = None,
        ids: list[str] | None = None,
        client_id: str | None = None,
        client_ids: list[str] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        due_from: date | None = None,
        due_to: date | None = None,
        issued_from: date | None = None,
        issued_to: date | None = None,
        amount_min: int | None = None,
        amount_max: int | None = None,
        unpaid_amount_min: int | None = None,
        unpaid_amount_max: int | None = None,
        keyword: str | None = None,
    ) -> tuple[int, int, int]:
        where = self._agent_where(
            center_id,
            status=status,
            ids=ids,
            client_id=client_id,
            client_ids=client_ids,
            date_from=date_from,
            date_to=date_to,
            due_from=due_from,
            due_to=due_to,
            issued_from=issued_from,
            issued_to=issued_to,
            amount_min=amount_min,
            amount_max=amount_max,
            unpaid_amount_min=unpaid_amount_min,
            unpaid_amount_max=unpaid_amount_max,
            keyword=keyword,
        )
        row = (
            await self._session.execute(
                select(
                    func.count(),
                    func.coalesce(func.sum(Billable.total_amount), 0),
                    func.coalesce(func.sum(Billable.unpaid_amount), 0),
                ).where(*where)
            )
        ).one()
        return int(row[0]), int(row[1]), int(row[2])

    @typecheck
    async def aggregate_unpaid_summary_for_client(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
    ) -> tuple[int, int, utc_dt | None]:
        row = (
            await self._session.execute(
                select(
                    func.count(),
                    func.coalesce(func.sum(Billable.unpaid_amount), 0),
                    func.min(Billable.issued_at),
                ).where(
                    Billable.center_id == center_id,
                    Billable.client_id == client_id,
                    Billable.deleted_at.is_(None),
                    Billable.status != "paid",
                    Billable.unpaid_amount > 0,
                )
            )
        ).one()
        return int(row[0]), int(row[1]), row[2]
