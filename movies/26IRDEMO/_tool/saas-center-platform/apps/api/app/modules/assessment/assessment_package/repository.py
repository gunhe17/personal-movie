from datetime import date, datetime, time

from sqlalchemy import func, or_, select, type_coerce
from sqlalchemy.dialects.postgresql import JSONB

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import AssessmentPackage


class AssessmentPackageRepository(PostgresRepository[AssessmentPackage]):
    model = AssessmentPackage

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        name: str,
        assessment_summary: list,
        description: str | None = None,
        center_member_summary: list | None = None,
        package_price: int | None = None,
        is_active: bool = True,
    ) -> AssessmentPackage:
        return await super().add(
            AssessmentPackage(
                center_id=center_id,
                name=name,
                assessment_summary=assessment_summary,
                description=description,
                center_member_summary=center_member_summary,
                package_price=package_price,
                is_active=is_active,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        package_id: uuid_str,
        center_id: uuid_str,
        *,
        name: str = unset,
        description: str | None = unset,
        assessment_summary: list = unset,
        center_member_summary: list | None = unset,
        package_price: int | None = unset,
        is_active: bool = unset,
    ) -> AssessmentPackage:
        await self.get_in_center(center_id=center_id, package_id=package_id)
        updated = await self.update_fields(
            package_id,
            name=name,
            description=description,
            assessment_summary=assessment_summary,
            center_member_summary=center_member_summary,
            package_price=package_price,
            is_active=is_active,
        )
        assert updated is not None
        return updated

    @typecheck
    async def remove_in_center(
        self,
        package_id: uuid_str,
        center_id: uuid_str,
    ) -> AssessmentPackage | None:
        await self.get_in_center(center_id=center_id, package_id=package_id)
        return await self.remove_by_id(package_id)

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        center_id: uuid_str,
        package_id: uuid_str,
    ) -> AssessmentPackage | None:
        return await self._find(
            where=[
                AssessmentPackage.center_id == center_id,
                AssessmentPackage.id == package_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        center_id: uuid_str,
        package_id: uuid_str,
    ) -> AssessmentPackage:
        assessment_package = await self.find_in_center(center_id=center_id, package_id=package_id)
        if assessment_package is None:
            raise EntityNotFoundException(f"AssessmentPackage not found: {package_id}")
        return assessment_package

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        search: str | None = None,
        assessment_type: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[AssessmentPackage], Page]:
        return await self._page(
            where=self._build_conditions(
                center_id=center_id,
                search=search,
                assessment_type=assessment_type,
                created_from=created_from,
                created_to=created_to,
            ),
            page=page,
            size=size,
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_ids(self, package_ids: list[str]) -> list[AssessmentPackage]:
        if not package_ids:
            return []
        return await self._filter(where=[AssessmentPackage.id.in_(package_ids)])

    @typecheck
    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        name: str | None = None,
        keyword: str | None = None,
        package_price_min: int | None = None,
        package_price_max: int | None = None,
        is_active: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list:
        where = [
            AssessmentPackage.center_id == center_id,
            AssessmentPackage.deleted_at.is_(None),
        ]
        if ids:
            where.append(AssessmentPackage.id.in_(ids))
        if name:
            where.append(AssessmentPackage.name.ilike(f"%{name}%"))
        if keyword:
            where.append(AssessmentPackage.description.ilike(f"%{keyword}%"))
        if package_price_min is not None:
            where.append(AssessmentPackage.package_price >= package_price_min)
        if package_price_max is not None:
            where.append(AssessmentPackage.package_price <= package_price_max)
        if is_active is not None:
            where.append(AssessmentPackage.is_active.is_(is_active))
        if date_from:
            where.append(AssessmentPackage.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(AssessmentPackage.created_at <= datetime.combine(date_to, time.max))
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        ids: list[str] | None = None,
        name: str | None = None,
        keyword: str | None = None,
        package_price_min: int | None = None,
        package_price_max: int | None = None,
        is_active: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[AssessmentPackage]:
        where = self._agent_where(
            center_id,
            ids=ids,
            name=name,
            keyword=keyword,
            package_price_min=package_price_min,
            package_price_max=package_price_max,
            is_active=is_active,
            date_from=date_from,
            date_to=date_to,
        )
        col, descending = resolve_sort(sort, columns=frozenset({"package_price"}))
        order_col = getattr(AssessmentPackage, col)
        order = order_col.desc() if descending else order_col.asc()
        rows = await self._session.execute(
            select(AssessmentPackage).where(*where).order_by(order).limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        name: str | None = None,
        keyword: str | None = None,
        package_price_min: int | None = None,
        package_price_max: int | None = None,
        is_active: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> int:
        where = self._agent_where(
            center_id,
            ids=ids,
            name=name,
            keyword=keyword,
            package_price_min=package_price_min,
            package_price_max=package_price_max,
            is_active=is_active,
            date_from=date_from,
            date_to=date_to,
        )
        count = await self._session.scalar(
            select(func.count()).select_from(AssessmentPackage).where(*where)
        )
        return count or 0

    # #
    # helpers

    def _build_conditions(
        self,
        center_id: str,
        search: str | None = None,
        assessment_type: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> list:
        where: list = [AssessmentPackage.center_id == center_id]
        if search:
            like = f"%{search}%"
            where.append(
                or_(
                    AssessmentPackage.name.ilike(like),
                    AssessmentPackage.description.ilike(like),
                )
            )
        if assessment_type:
            where.append(
                AssessmentPackage.assessment_summary.op("@>")(
                    type_coerce([{"type": assessment_type}], JSONB)
                )
            )
        if created_from is not None:
            where.append(AssessmentPackage.created_at >= created_from)
        if created_to is not None:
            where.append(AssessmentPackage.created_at <= created_to)
        return where
