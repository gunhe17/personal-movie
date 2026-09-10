from datetime import date, datetime, time
from typing import Any

from sqlalchemy import func, or_, select

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import FormTemplate


class FormTemplateRepository(PostgresRepository[FormTemplate]):
    model = FormTemplate

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str | None,
        name: str,
        version: int,
        schema: dict[str, Any],
        is_active: bool,
        status: str,
        source_template_id: uuid_str | None = None,
    ) -> FormTemplate:
        return await super().add(
            FormTemplate(
                center_id=center_id,
                name=name,
                version=version,
                schema=schema,
                is_active=is_active,
                status=status,
                source_template_id=source_template_id,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        is_active: bool = unset,
        status: str = unset,
        schema: dict[str, Any] = unset,
    ) -> FormTemplate | None:
        return await self.update_fields(
            id, is_active=is_active, status=status, schema=schema
        )

    # #
    # query

    @typecheck
    async def find_active_by_center_and_source(
        self,
        center_id: uuid_str,
        source_template_id: uuid_str,
    ) -> FormTemplate | None:
        return await self._find(
            where=[
                FormTemplate.center_id == center_id,
                FormTemplate.source_template_id == source_template_id,
                FormTemplate.is_active == True,  # noqa: E712
            ]
        )

    @typecheck
    async def find_active_by_center_and_name(
        self,
        center_id: uuid_str | None,
        name: str,
    ) -> FormTemplate | None:
        center_cond = (
            FormTemplate.center_id.is_(None)
            if center_id is None
            else FormTemplate.center_id == center_id
        )
        return await self._find(
            where=[
                center_cond,
                FormTemplate.name == name,
                FormTemplate.is_active == True,  # noqa: E712
            ]
        )

    @typecheck
    async def find_by_id_with_center(
        self,
        template_id: uuid_str,
        center_id: uuid_str,
    ) -> FormTemplate | None:
        return await self._find(
            where=[
                FormTemplate.id == template_id,
                or_(
                    FormTemplate.center_id == center_id,
                    FormTemplate.center_id.is_(None),
                ),
            ]
        )

    @typecheck
    async def get_by_id_with_center(
        self,
        template_id: uuid_str,
        center_id: uuid_str,
    ) -> FormTemplate:
        template = await self.find_by_id_with_center(
            template_id=template_id,
            center_id=center_id,
        )
        if template is None:
            raise EntityNotFoundException(f"FormTemplate not found: {template_id}")
        return template

    @typecheck
    async def list_by_center(
        self,
        center_id: uuid_str,
        include_system: bool = True,
        include_inactive: bool = False,
    ) -> list[FormTemplate]:
        # 기본은 활성만 — 이 목록을 소비하는 대다수가 '고를 수 있는 양식' 피커다.
        # 관리 화면만 include_inactive=True로 비활성까지 받아 토글로 되돌릴 수 있게 한다.
        where = [] if include_inactive else [FormTemplate.is_active == True]  # noqa: E712
        if include_system:
            where.append(
                or_(
                    FormTemplate.center_id == center_id,
                    FormTemplate.center_id.is_(None),
                )
            )
        else:
            where.append(FormTemplate.center_id == center_id)
        stmt = (
            select(FormTemplate)
            .where(FormTemplate.deleted_at.is_(None), *where)
            .order_by(FormTemplate.name, FormTemplate.version.desc())
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_by_filters(
        self,
        center_id: uuid_str,
        include_system: bool = True,
        name: str | None = None,
        is_active: bool | None = None,
        version: int | None = None,
    ) -> list[FormTemplate]:
        where = []
        if include_system:
            where.append(
                or_(
                    FormTemplate.center_id == center_id,
                    FormTemplate.center_id.is_(None),
                )
            )
        else:
            where.append(FormTemplate.center_id == center_id)
        if name:
            where.append(FormTemplate.name.ilike(f"%{name}%"))
        if is_active is not None:
            where.append(FormTemplate.is_active == is_active)
        if version is not None:
            where.append(FormTemplate.version == version)
        stmt = (
            select(FormTemplate)
            .where(FormTemplate.deleted_at.is_(None), *where)
            .order_by(FormTemplate.name, FormTemplate.version.desc())
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 50,
        name: str | None = None,
        is_active: bool | None = None,
        status: str | None = None,
        version: int | None = None,
        include_system: bool = True,
        date_from: date | None = None,
        date_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[FormTemplate], int]:
        where = []
        if ids is not None:
            where.append(FormTemplate.id.in_(ids))
        if include_system:
            where.append(
                or_(
                    FormTemplate.center_id == center_id,
                    FormTemplate.center_id.is_(None),
                )
            )
        else:
            where.append(FormTemplate.center_id == center_id)
        if name:
            where.append(FormTemplate.name.ilike(f"%{name}%"))
        if is_active is not None:
            where.append(FormTemplate.is_active == is_active)
        if status:
            where.append(FormTemplate.status == status)
        if version is not None:
            where.append(FormTemplate.version == version)
        if date_from:
            where.append(FormTemplate.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(FormTemplate.created_at <= datetime.combine(date_to, time.max))
        if sort:
            col, descending = resolve_sort(sort)
            order_col = getattr(FormTemplate, col)
            order = (order_col.desc() if descending else order_col.asc(),)
        else:
            order = (FormTemplate.name, FormTemplate.version.desc())
        stmt = (
            select(FormTemplate)
            .where(FormTemplate.deleted_at.is_(None), *where)
            .order_by(*order)
            .limit(limit)
        )
        rows = await self._scalars(stmt)
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def next_version(
        self,
        center_id: uuid_str | None,
        name: str,
    ) -> int:
        # 같은 시리즈(center_id, name)의 다음 버전 번호 발급 (max+1). 호출부는 +1 하지 않는다.
        center_cond = (
            FormTemplate.center_id.is_(None)
            if center_id is None
            else FormTemplate.center_id == center_id
        )
        stmt = select(func.coalesce(func.max(FormTemplate.version), 0) + 1).where(
            center_cond,
            FormTemplate.name == name,
            FormTemplate.deleted_at.is_(None),
        )
        return (await self._session.execute(stmt)).scalar_one()
