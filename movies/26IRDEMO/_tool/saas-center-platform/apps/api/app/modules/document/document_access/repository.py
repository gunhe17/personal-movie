from math import ceil

from sqlalchemy import func, select

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from ..document.models import Document
from .models import DocumentAccess


class DocumentAccessRepository(PostgresRepository[DocumentAccess]):
    model = DocumentAccess

    # #
    # command (append-only)

    @typecheck
    async def add(
        self,
        document_id: uuid_str,
        s3_version_id: str | None,
        account_id: uuid_str | None,
        action: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> DocumentAccess:
        return await super().add(
            DocumentAccess(
                document_id=document_id,
                s3_version_id=s3_version_id,
                account_id=account_id,
                action=action,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        )

    # #
    # query

    @typecheck
    async def list_by_document_with_page(
        self,
        document_id: uuid_str,
        *,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[DocumentAccess], Page]:
        where = [
            DocumentAccess.document_id == document_id,
            DocumentAccess.deleted_at.is_(None),
        ]
        offset = (page - 1) * size
        stmt = (
            select(DocumentAccess)
            .where(*where)
            .order_by(DocumentAccess.accessed_at.desc())
            .offset(offset)
            .limit(size)
        )
        items = await self._scalars(stmt)
        total = await self._session.scalar(
            select(func.count()).select_from(DocumentAccess).where(*where)
        ) or 0
        return items, Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )

    @typecheck
    async def list_by_account_with_page(
        self,
        account_id: uuid_str,
        center_id: uuid_str,
        *,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[DocumentAccess], Page]:
        where = [
            DocumentAccess.account_id == account_id,
            DocumentAccess.deleted_at.is_(None),
            Document.center_id == center_id,
            Document.deleted_at.is_(None),
        ]
        offset = (page - 1) * size
        stmt = (
            select(DocumentAccess)
            .join(Document, DocumentAccess.document_id == Document.id)
            .where(*where)
            .order_by(DocumentAccess.accessed_at.desc())
            .offset(offset)
            .limit(size)
        )
        items = await self._scalars(stmt)
        total = await self._session.scalar(
            select(func.count())
            .select_from(DocumentAccess)
            .join(Document, DocumentAccess.document_id == Document.id)
            .where(*where)
        ) or 0
        return items, Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )
