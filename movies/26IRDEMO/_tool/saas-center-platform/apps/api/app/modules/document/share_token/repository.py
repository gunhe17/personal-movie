from math import ceil

from sqlalchemy import func, select
from sqlalchemy import update as sql_update

from app.core.exceptions import EntityNotFoundException
from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import ShareToken


class ShareTokenRepository(PostgresRepository[ShareToken]):
    model = ShareToken

    # #
    # command

    @typecheck
    async def add(
        self,
        token: str,
        document_id: uuid_str,
        created_by: uuid_str,
        expires_at: utc_dt,
        max_downloads: int | None,
        download_count: int,
        password_hash: str | None,
    ) -> ShareToken:
        return await super().add(
            ShareToken(
                token=token,
                document_id=document_id,
                created_by=created_by,
                expires_at=expires_at,
                max_downloads=max_downloads,
                download_count=download_count,
                password_hash=password_hash,
            )
        )

    @typecheck
    async def increment_download_count(self, id: uuid_str) -> ShareToken | None:
        stmt = (
            sql_update(ShareToken)
            .where(ShareToken.id == id, ShareToken.deleted_at.is_(None))
            .values(download_count=ShareToken.download_count + 1, updated_at=func.now())
            .returning(ShareToken)
        )
        model = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return model

    # #
    # query

    @typecheck
    async def find_by_token(self, token: str) -> ShareToken | None:
        return await self._find(where=[ShareToken.token == token])

    @typecheck
    async def get_by_token(self, token: str) -> ShareToken:
        share_token = await self.find_by_token(token)
        if share_token is None:
            raise EntityNotFoundException(f"Invalid token: {token}")
        return share_token

    @typecheck
    async def list_by_document_with_page(
        self,
        document_id: uuid_str,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[ShareToken], Page]:
        where = [
            ShareToken.document_id == document_id,
            ShareToken.deleted_at.is_(None),
        ]
        offset = (page - 1) * size
        stmt = (
            select(ShareToken)
            .where(*where)
            .order_by(ShareToken.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        items = await self._scalars(stmt)
        total = await self._session.scalar(
            select(func.count()).select_from(ShareToken).where(*where)
        ) or 0
        return items, Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )
