from datetime import date
from math import ceil

from sqlalchemy import func, or_, select
from sqlalchemy import update as sql_update

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import Voucher


class VoucherRepository(PostgresRepository[Voucher]):
    model = Voucher

    # #
    # command

    @typecheck
    async def add(
        self,
        name: str,
        program_name: str,
        program_organization: str,
        program_year: int,
        usage_start_date: date | None = None,
        usage_end_date: date | None = None,
        application_method: str | None = None,
        application_start_date: date | None = None,
        application_end_date: date | None = None,
        support_amount: dict | None = None,
        support_scope: str | None = None,
        support_target: str | None = None,
        contact: str | None = None,
        eligibility: dict | None = None,
        record: dict | None = None,
    ) -> Voucher:
        return await super().add(
            Voucher(
                name=name,
                program_name=program_name,
                program_organization=program_organization,
                program_year=program_year,
                usage_start_date=usage_start_date,
                usage_end_date=usage_end_date,
                application_method=application_method,
                application_start_date=application_start_date,
                application_end_date=application_end_date,
                support_amount=support_amount,
                support_scope=support_scope,
                support_target=support_target,
                contact=contact,
                eligibility=eligibility,
                record=record,
            )
        )

    @typecheck
    async def remove_by_id(self, id: uuid_str) -> Voucher | None:
        return await super().remove_by_id(id)

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        program_name: str = unset,
        program_organization: str = unset,
        program_year: int = unset,
        usage_start_date: date | None = unset,
        usage_end_date: date | None = unset,
        application_method: str | None = unset,
        application_start_date: date | None = unset,
        application_end_date: date | None = unset,
        support_amount: dict | None = unset,
        support_scope: str | None = unset,
        support_target: str | None = unset,
        contact: str | None = unset,
        eligibility: dict | None = unset,
        record: dict | None = unset,
    ) -> Voucher | None:
        fields = {
            "name": name,
            "program_name": program_name,
            "program_organization": program_organization,
            "program_year": program_year,
            "usage_start_date": usage_start_date,
            "usage_end_date": usage_end_date,
            "application_method": application_method,
            "application_start_date": application_start_date,
            "application_end_date": application_end_date,
            "support_amount": support_amount,
            "support_scope": support_scope,
            "support_target": support_target,
            "contact": contact,
            "eligibility": eligibility,
            "record": record,
        }
        data = {k: v for k, v in fields.items() if v is not unset}
        stmt = (
            sql_update(Voucher)
            .where(Voucher.id == id)
            .values(**data, updated_at=func.now())
            .returning(Voucher)
        )
        model = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return model

    # #
    # query

    @typecheck
    async def find_by_id_all_states(self, id: uuid_str) -> Voucher | None:
        return await self._first(
            select(Voucher).where(Voucher.id == id)
        )

    @typecheck
    async def get_by_id_all_states(self, id: uuid_str) -> Voucher:
        voucher = await self.find_by_id_all_states(id=id)
        if voucher is None:
            raise EntityNotFoundException(f"바우처를 찾을 수 없습니다: {id}")
        return voucher

    @typecheck
    async def find_active_duplicate(
        self,
        name: str,
        program_year: int,
        program_organization: str,
    ) -> Voucher | None:
        return await self._find(
            where=[
                Voucher.name == name,
                Voucher.program_year == program_year,
                Voucher.program_organization == program_organization,
            ]
        )

    @typecheck
    async def list_catalog(self) -> list[Voucher]:
        return await self._filter(order_by="program_year", descending=True)

    @typecheck
    async def list_many_by_ids(
        self,
        ids: list[str],
    ) -> list[Voucher]:
        if not ids:
            return []
        stmt = select(Voucher).where(
            Voucher.id.in_(ids),
            Voucher.deleted_at.is_(None),
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_with_filters_with_page(
        self,
        q: str | None = None,
        year: int | None = None,
        organization: str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Voucher], Page]:
        conditions = []
        if year is not None:
            conditions.append(Voucher.program_year == year)
        if organization:
            conditions.append(Voucher.program_organization == organization)
        if q:
            pattern = f"%{q}%"
            conditions.append(
                or_(
                    Voucher.name.ilike(pattern),
                    Voucher.program_name.ilike(pattern),
                    Voucher.support_target.ilike(pattern),
                )
            )

        count_stmt = select(func.count()).select_from(Voucher)
        if conditions:
            count_stmt = count_stmt.where(*conditions)
        total = await self._session.scalar(count_stmt) or 0

        offset = (page - 1) * size
        stmt = (
            select(Voucher)
            .order_by(
                Voucher.deleted_at.is_not(None).asc(),
                Voucher.program_year.desc(),
                Voucher.created_at.desc(),
            )
            .offset(offset)
            .limit(size)
        )
        if conditions:
            stmt = stmt.where(*conditions)
        rows = await self._scalars(stmt)
        return rows, Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )

    # #
    # helpers

    async def _first(self, stmt) -> Voucher | None:
        rows = await self._scalars(stmt)
        return rows[0] if rows else None
