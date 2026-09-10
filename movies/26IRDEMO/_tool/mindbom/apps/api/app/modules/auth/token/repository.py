"""RefreshToken Repository"""
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.core.datetime_utils import utc_now
from app.modules.auth.token.models import RefreshToken


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    def __init__(self, session: AsyncSession):
        super().__init__(RefreshToken, session)

    async def get_by_token_hash(self, token_hash: str) -> RefreshToken | None:
        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def count_active_for_account(self, account_id: str) -> int:
        """계정의 활성 refresh token 개수"""
        stmt = select(func.count()).select_from(RefreshToken).where(
            RefreshToken.account_id == account_id,
            RefreshToken.deleted_at.is_(None),
            RefreshToken.expires_at > utc_now(),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def revoke_all_for_account(self, account_id: str) -> None:
        """계정의 모든 refresh token soft delete"""
        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.account_id == account_id,
                RefreshToken.deleted_at.is_(None),
            )
            .values(deleted_at=utc_now())
        )
        await self._session.execute(stmt)
