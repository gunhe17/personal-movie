from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql.ranges import Range

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import FormExtraction, FormExtractionStatus


class FormExtractionRepository(PostgresRepository[FormExtraction]):
    model = FormExtraction

    # #
    # command

    @typecheck
    async def add(
        self,
        status: FormExtractionStatus,
        name: str,
        source_document_id: uuid_str,
        center_id: uuid_str | None = None,
        started_at: utc_dt | None = None,
        page_range: Range | None = None,
    ) -> FormExtraction:
        kwargs: dict[str, Any] = {
            "status": status,
            "name": name,
            "source_document_id": source_document_id,
            "center_id": center_id,
            "page_range": page_range,
        }
        if started_at is not None:
            kwargs["started_at"] = started_at
        return await super().add(FormExtraction(**kwargs))

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        status: FormExtractionStatus = unset,
        image_document_id: uuid_str | None = unset,
        completed: dict | None = unset,
        completed_at: utc_dt | None = unset,
        failed: str | None = unset,
        failed_at: utc_dt | None = unset,
    ) -> FormExtraction:
        await self.get_by_id(id)
        updated = await self.update_fields(
            id,
            status=status,
            image_document_id=image_document_id,
            completed=completed,
            completed_at=completed_at,
            failed=failed,
            failed_at=failed_at,
        )
        assert updated is not None
        return updated

    @typecheck
    async def find_for_update(self, id: uuid_str) -> FormExtraction | None:
        stmt = (
            select(FormExtraction)
            .where(
                FormExtraction.id == id,
                FormExtraction.deleted_at.is_(None),
            )
            .with_for_update()
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    @typecheck
    async def get_for_update(self, id: uuid_str) -> FormExtraction:
        extraction = await self.find_for_update(id)
        if extraction is None or extraction.deleted_at is not None:
            raise EntityNotFoundException(f"FormExtraction not found: {id}")
        return extraction

    # #
    # query

    @typecheck
    async def list_paginated_with_page(
        self,
        *,
        status: FormExtractionStatus | None = None,
        center_id: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[FormExtraction], Page]:
        where = []
        if status:
            where.append(FormExtraction.status == status)
        if center_id is not None:
            where.append(FormExtraction.center_id == center_id)
        return await self._page(
            where=where,
            page=page,
            size=size,
            order_by="created_at",
            descending=True,
        )
