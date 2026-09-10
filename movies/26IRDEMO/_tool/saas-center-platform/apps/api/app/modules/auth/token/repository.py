from sqlalchemy import delete, select

from app.core.exceptions import EntityNotFoundException
from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import RefreshToken


class RefreshTokenRepository(PostgresRepository[RefreshToken]):
    model = RefreshToken

    # #
    # command

    @typecheck
    async def add(
        self,
        account_id: uuid_str,
        token_hash: str,
        expires_at: utc_dt,
        device_info: str | None = None,
        ip_address: str | None = None,
        parent_token_id: uuid_str | None = None,
    ) -> RefreshToken:
        return await super().add(
            RefreshToken(
                account_id=account_id,
                token_hash=token_hash,
                expires_at=expires_at,
                device_info=device_info,
                ip_address=ip_address,
                parent_token_id=parent_token_id,
            )
        )

    @typecheck
    async def hard_delete_by_account_id(self, account_id: str) -> list[RefreshToken]:
        stmt = (
            delete(RefreshToken)
            .where(RefreshToken.account_id == account_id)
            .returning(RefreshToken)
        )
        rows = list((await self._session.execute(stmt)).scalars().all())
        await self._session.flush()
        return rows

    @typecheck
    async def hard_delete_oldest_by_account(self, account_id: str) -> bool:
        oldest_stmt = (
            select(RefreshToken.id)
            .where(RefreshToken.account_id == account_id)
            .order_by(RefreshToken.created_at.asc())
            .limit(1)
        )
        result = await self._session.execute(oldest_stmt)
        oldest_id = result.scalar_one_or_none()
        if not oldest_id:
            return False

        delete_stmt = delete(RefreshToken).where(RefreshToken.id == oldest_id)
        await self._session.execute(delete_stmt)
        await self._session.flush()
        return True

    @typecheck
    async def hard_delete_by_id(self, token_id: str) -> bool:
        stmt = delete(RefreshToken).where(RefreshToken.id == token_id)
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount > 0

    # #
    # query

    @typecheck
    async def get_by_account(
        self,
        id: str,
        account_id: str,
    ) -> RefreshToken:
        session = await self._find(
            where=[RefreshToken.id == id, RefreshToken.account_id == account_id]
        )
        if session is None:
            raise EntityNotFoundException(f"Session not found: {id}")
        return session

    @typecheck
    async def find_by_token_hash(
        self,
        token_hash: str,
        for_update: bool = False,
    ) -> RefreshToken | None:
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        if for_update:
            stmt = stmt.with_for_update()
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    @typecheck
    async def count_by_account_id(self, account_id: str) -> int:
        return await self._count(where=[RefreshToken.account_id == account_id])

    @typecheck
    async def list_by_account_id(self, account_id: str) -> list[RefreshToken]:
        return await self._filter(
            where=[RefreshToken.account_id == account_id],
            order_by="created_at",
            descending=True,
        )
