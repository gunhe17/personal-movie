from datetime import date, datetime, time

from sqlalchemy import select

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import Document


class DocumentRepository(PostgresRepository[Document]):
    model = Document

    # #
    # command

    @typecheck
    async def update_in_center(
        self,
        id: uuid_str,
        center_id: uuid_str,
        *,
        name: str = unset,
        description: str | None = unset,
        file_type: str = unset,
        file_size: int = unset,
        checksum: str = unset,
        access_level: str = unset,
        storage_path: str = unset,
    ) -> Document:
        document = await self.get_by_id(id)
        if document.center_id != center_id:
            raise EntityNotFoundException(f"Document not found: {id}")
        updated = await self.update_fields(
            id,
            name=name,
            description=description,
            file_type=file_type,
            file_size=file_size,
            checksum=checksum,
            access_level=access_level,
            storage_path=storage_path,
        )
        assert updated is not None
        return updated

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        uploader_id: uuid_str,
        name: str,
        original_name: str | None,
        description: str | None,
        storage_path: str,
        file_type: str,
        file_size: int,
        checksum: str,
        access_level: str,
    ) -> Document:
        return await super().add(
            Document(
                center_id=center_id,
                uploader_id=uploader_id,
                name=name,
                original_name=original_name,
                description=description,
                storage_path=storage_path,
                file_type=file_type,
                file_size=file_size,
                checksum=checksum,
                access_level=access_level,
            )
        )

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        document_id: uuid_str,
        center_id: uuid_str,
    ) -> Document | None:
        return await self._find(
            where=[Document.id == document_id, Document.center_id == center_id]
        )

    @typecheck
    async def get_in_center(
        self,
        document_id: uuid_str,
        center_id: uuid_str,
    ) -> Document:
        document = await self.find_in_center(document_id=document_id, center_id=center_id)
        if document is None:
            raise EntityNotFoundException(f"Document not found: {document_id}")
        return document

    @typecheck
    async def get_in_center_including_deleted(
        self,
        document_id: uuid_str,
        center_id: uuid_str,
    ) -> Document:
        stmt = select(Document).where(
            Document.id == document_id, Document.center_id == center_id
        )
        rows = await self._scalars(stmt)
        if not rows:
            raise EntityNotFoundException(f"Document not found: {document_id}")
        return rows[0]

    @typecheck
    async def find_by_id_including_deleted(
        self,
        document_id: uuid_str,
    ) -> Document | None:
        stmt = select(Document).where(Document.id == document_id)
        rows = await self._scalars(stmt)
        return rows[0] if rows else None

    @typecheck
    async def get_by_id_including_deleted(
        self,
        document_id: uuid_str,
    ) -> Document:
        document = await self.find_by_id_including_deleted(document_id=document_id)
        if document is None:
            raise EntityNotFoundException(f"Document not found: {document_id}")
        return document


    @typecheck
    async def list_by_ids(
        self,
        document_ids: list[str],
        center_id: uuid_str,
    ) -> list[Document]:
        if not document_ids:
            return []
        return await self._filter(
            where=[
                Document.id.in_(document_ids),
                Document.center_id == center_id,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_filters(
        self,
        center_id: uuid_str,
        name: str | None = None,
        description: str | None = None,
        file_type: str | None = None,
        uploader_id: uuid_str | None = None,
        access_level: str | None = None,
        file_size_from: int | None = None,
        file_size_to: int | None = None,
        *,
        limit: int = 50,
    ) -> list[Document]:
        where = [Document.center_id == center_id]
        if name:
            where.append(Document.name.ilike(f"%{name}%"))
        if description:
            where.append(Document.description.ilike(f"%{description}%"))
        if file_type:
            where.append(Document.file_type.ilike(f"%{file_type}%"))
        if uploader_id:
            where.append(Document.uploader_id == uploader_id)
        if access_level:
            where.append(Document.access_level == access_level)
        if file_size_from is not None:
            where.append(Document.file_size >= file_size_from)
        if file_size_to is not None:
            where.append(Document.file_size <= file_size_to)
        return await self._filter(
            where=where,
            order_by="created_at",
            descending=True,
            limit=limit,
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        name: str | None = None,
        file_type: str | None = None,
        access_level: str | None = None,
        uploader_id: str | None = None,
        file_size_min: int | None = None,
        file_size_max: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Document], int]:
        where = [Document.center_id == center_id]
        if ids is not None:
            where.append(Document.id.in_(ids))
        if name:
            where.append(Document.name.ilike(f"%{name}%"))
        if file_type:
            where.append(Document.file_type.ilike(f"%{file_type}%"))
        if access_level:
            where.append(Document.access_level == access_level)
        if uploader_id:
            where.append(Document.uploader_id == uploader_id)
        if file_size_min is not None:
            where.append(Document.file_size >= file_size_min)
        if file_size_max is not None:
            where.append(Document.file_size <= file_size_max)
        if date_from:
            where.append(Document.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(Document.created_at <= datetime.combine(date_to, time.max))
        col, descending = resolve_sort(sort, columns=frozenset({"file_size"}))
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        uploader_id: uuid_str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Document], Page]:
        where = [Document.center_id == center_id]
        if uploader_id is not None:
            where.append(Document.uploader_id == uploader_id)
        return await self._page(
            where=where,
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )

    @typecheck
    async def list_in_center_with_page_including_deleted(
        self,
        center_id: uuid_str,
        uploader_id: uuid_str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Document], Page]:
        where = [Document.center_id == center_id]
        if uploader_id is not None:
            where.append(Document.uploader_id == uploader_id)
        return await self._page_including_deleted(
            where=where,
            page=page,
            size=size,
        )

    # #
    # helpers

    async def _page_including_deleted(
        self,
        *,
        where: list,
        page: int,
        size: int,
    ) -> tuple[list[Document], Page]:
        from math import ceil

        from sqlalchemy import func

        offset = (page - 1) * size
        stmt = (
            select(Document)
            .where(*where)
            .order_by(Document.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        items = await self._scalars(stmt)
        total = await self._session.scalar(
            select(func.count()).select_from(Document).where(*where)
        ) or 0
        return items, Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )
