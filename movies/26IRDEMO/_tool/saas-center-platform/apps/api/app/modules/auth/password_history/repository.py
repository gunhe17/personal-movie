from sqlalchemy import delete, select

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import PasswordHistory


class PasswordHistoryRepository(PostgresRepository[PasswordHistory]):
    model = PasswordHistory

    # #
    # command

    @typecheck
    async def add(
        self,
        account_id: uuid_str,
        password: str,
    ) -> PasswordHistory:
        return await super().add(
            PasswordHistory(
                account_id=account_id,
                password=password,
            )
        )

    @typecheck
    async def hard_delete_old_histories(
        self,
        account_id: str,
        keep_count: int = 3,
    ) -> int:
        recent_stmt = (
            select(PasswordHistory.id)
            .where(PasswordHistory.account_id == account_id)
            .order_by(PasswordHistory.created_at.desc())
            .limit(keep_count)
        )
        recent_result = await self._session.execute(recent_stmt)
        recent_ids = [row[0] for row in recent_result.all()]
        if not recent_ids:
            return 0

        delete_stmt = delete(PasswordHistory).where(
            PasswordHistory.account_id == account_id,
            PasswordHistory.id.notin_(recent_ids),
        )
        result = await self._session.execute(delete_stmt)
        await self._session.flush()
        return result.rowcount

    # #
    # query

    @typecheck
    async def list_recent_by_account(
        self,
        account_id: str,
        limit: int = 3,
    ) -> list[PasswordHistory]:
        return await self._filter(
            where=[PasswordHistory.account_id == account_id],
            order_by="created_at",
            descending=True,
            limit=limit,
        )
