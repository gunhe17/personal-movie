from sqlalchemy import select

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import GlobalDocument


class GlobalDocumentRepository(PostgresRepository[GlobalDocument]):
    model = GlobalDocument

    # #
    # command

    @typecheck
    async def add(
        self,
        name: str,
        original_name: str | None,
        description: str | None,
        storage_path: str,
        file_type: str,
        file_size: int,
        checksum: str | None,
        uploader_id: uuid_str | None,
    ) -> GlobalDocument:
        return await super().add(
            GlobalDocument(
                name=name,
                original_name=original_name,
                description=description,
                storage_path=storage_path,
                file_type=file_type,
                file_size=file_size,
                checksum=checksum,
                uploader_id=uploader_id,
            )
        )

    # #
    # query

    @typecheck
    async def list_many_by_ids(
        self, ids: list[str]
    ) -> list[GlobalDocument]:
        if not ids:
            return []
        stmt = select(GlobalDocument).where(
            GlobalDocument.id.in_(ids),
            GlobalDocument.deleted_at.is_(None),
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_many_by_ids_including_deleted(
        self, ids: list[str]
    ) -> list[GlobalDocument]:
        if not ids:
            return []
        stmt = select(GlobalDocument).where(GlobalDocument.id.in_(ids))
        return await self._scalars(stmt)

    @typecheck
    async def list_with_filters_with_page(
        self,
        *,
        q: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[GlobalDocument], Page]:
        where = []
        if q:
            where.append(GlobalDocument.name.ilike(f"%{q}%"))

        return await self._page(
            where=where,
            page=page,
            size=size,
            order_by="created_at",
            descending=True,
        )
