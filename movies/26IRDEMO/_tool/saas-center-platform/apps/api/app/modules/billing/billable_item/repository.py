from sqlalchemy import and_, func, or_, select

from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from ..billable.models import Billable
from .models import BillableItem


class BillableItemRepository(PostgresRepository[BillableItem]):
    model = BillableItem

    # #
    # command

    @typecheck
    async def add(
        self,
        billable_id: uuid_str,
        item_type: str,
        description: str,
        quantity: int,
        unit_price: int,
        amount: int,
        subsidy_amount: int,
        item_id: uuid_str | None = None,
        related_type: str | None = None,
        related_case_id: uuid_str | None = None,
        related_session_id: uuid_str | None = None,
        client_voucher_id: uuid_str | None = None,
        price_list_id: uuid_str | None = None,
        provided_at: utc_dt | None = None,
        memo: str | None = None,
    ) -> BillableItem:
        return await super().add(
            BillableItem(
                billable_id=billable_id,
                item_type=item_type,
                description=description,
                quantity=quantity,
                unit_price=unit_price,
                amount=amount,
                subsidy_amount=subsidy_amount,
                item_id=item_id,
                related_type=related_type,
                related_case_id=related_case_id,
                related_session_id=related_session_id,
                client_voucher_id=client_voucher_id,
                price_list_id=price_list_id,
                provided_at=provided_at,
                memo=memo,
            )
        )

    @typecheck
    async def remove_by_billable(self, billable_id: uuid_str) -> int:
        return await self.remove_where(where=[BillableItem.billable_id == billable_id])

    # #
    # query

    @typecheck
    async def list_by_billable(self, billable_id: uuid_str) -> list[BillableItem]:
        return await self._filter(
            where=[BillableItem.billable_id == billable_id],
            order_by="created_at",
        )

    @typecheck
    async def aggregate_amount(self, billable_id: uuid_str) -> int:
        return await self._session.scalar(
            select(func.coalesce(func.sum(BillableItem.amount), 0)).where(
                BillableItem.billable_id == billable_id,
                BillableItem.deleted_at.is_(None),
            )
        )

    @typecheck
    async def list_billed_session_ids(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        related_type: str,
    ) -> set[str]:
        stmt = (
            select(BillableItem.related_session_id)
            .join(Billable, BillableItem.billable_id == Billable.id)
            .where(
                Billable.center_id == center_id,
                Billable.client_id == client_id,
                Billable.deleted_at.is_(None),
                BillableItem.deleted_at.is_(None),
                BillableItem.related_type == related_type,
                BillableItem.related_session_id.is_not(None),
            )
            .distinct()
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return {r for r in rows if r}

    @typecheck
    async def map_session_to_client_voucher(
        self,
        session_ids: list[str],
    ) -> dict[str, str]:
        """회기별 소비된 바우처(client_voucher_id). 바우처 청구가 있는 회기만 포함."""
        if not session_ids:
            return {}
        stmt = (
            select(BillableItem.related_session_id, BillableItem.client_voucher_id)
            .join(Billable, BillableItem.billable_id == Billable.id)
            .where(
                Billable.deleted_at.is_(None),
                BillableItem.deleted_at.is_(None),
                BillableItem.related_session_id.in_(session_ids),
                BillableItem.client_voucher_id.is_not(None),
            )
        )
        rows = (await self._session.execute(stmt)).all()
        return {sid: cv_id for sid, cv_id in rows if sid and cv_id}

    @typecheck
    async def list_billed_case_ids(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        related_type: str,
    ) -> set[str]:
        stmt = (
            select(BillableItem.related_case_id)
            .join(Billable, BillableItem.billable_id == Billable.id)
            .where(
                Billable.center_id == center_id,
                Billable.client_id == client_id,
                Billable.deleted_at.is_(None),
                BillableItem.deleted_at.is_(None),
                BillableItem.related_type == related_type,
                BillableItem.related_case_id.is_not(None),
            )
            .distinct()
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return {r for r in rows if r}

    @typecheck
    async def aggregate_coverage_rows(
        self,
        center_id: uuid_str,
        counseling_session_ids: set[str],
        assessment_session_ids: set[str],
        counseling_case_ids: set[str],
        assessment_case_ids: set[str],
    ) -> list[tuple]:
        scope = []
        if counseling_session_ids:
            scope.append(and_(BillableItem.related_type == "counseling_session", BillableItem.related_session_id.in_(counseling_session_ids)))
        if assessment_session_ids:
            scope.append(and_(BillableItem.related_type == "assessment_session", BillableItem.related_session_id.in_(assessment_session_ids)))
        if counseling_case_ids:
            scope.append(and_(BillableItem.related_type == "counseling_case", BillableItem.related_case_id.in_(counseling_case_ids)))
        if assessment_case_ids:
            scope.append(and_(BillableItem.related_type == "assessment_case", BillableItem.related_case_id.in_(assessment_case_ids)))
        if not scope:
            return []
        stmt = (
            select(
                BillableItem.related_type,
                BillableItem.related_case_id,
                BillableItem.related_session_id,
                Billable.client_id,
            )
            .join(Billable, BillableItem.billable_id == Billable.id)
            .where(
                Billable.center_id == center_id,
                Billable.deleted_at.is_(None),
                BillableItem.deleted_at.is_(None),
                or_(*scope),
            )
        )
        return list((await self._session.execute(stmt)).all())

    @typecheck
    async def list_usage_by_voucher(
        self,
        center_id: uuid_str,
        client_voucher_id: uuid_str,
    ) -> list[tuple[BillableItem, Billable]]:
        stmt = (
            select(BillableItem, Billable)
            .join(Billable, BillableItem.billable_id == Billable.id)
            .where(
                BillableItem.client_voucher_id == client_voucher_id,
                BillableItem.deleted_at.is_(None),
                Billable.center_id == center_id,
                Billable.deleted_at.is_(None),
            )
            .order_by(Billable.billable_date.desc(), BillableItem.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    @typecheck
    async def aggregate_usage_by_voucher_monthly(
        self,
        center_id: uuid_str,
        client_voucher_id: uuid_str,
    ) -> list[tuple[str, int, int, int, int]]:
        year_month = func.to_char(Billable.billable_date, "YYYY-MM").label("year_month")
        stmt = (
            select(
                year_month,
                func.count(
                    func.distinct(
                        func.coalesce(
                            BillableItem.related_session_id,
                            BillableItem.related_case_id,
                            BillableItem.id,
                        )
                    )
                ).label("sessions"),
                func.coalesce(func.sum(BillableItem.amount), 0).label("amount"),
                func.coalesce(func.sum(BillableItem.subsidy_amount), 0).label("subsidy_amount"),
                func.count(BillableItem.id).label("item_count"),
            )
            .join(Billable, BillableItem.billable_id == Billable.id)
            .where(
                BillableItem.client_voucher_id == client_voucher_id,
                BillableItem.deleted_at.is_(None),
                Billable.center_id == center_id,
                Billable.deleted_at.is_(None),
            )
            .group_by(year_month)
            .order_by(year_month.desc())
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            (r.year_month, int(r.sessions), int(r.amount), int(r.subsidy_amount), int(r.item_count))
            for r in rows
        ]
