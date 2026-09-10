"""Password Reset Token Repository"""
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.auth.password_reset.models import PasswordResetToken


class PasswordResetTokenRepository(BaseRepository[PasswordResetToken]):
    def __init__(self, session: AsyncSession):
        super().__init__(PasswordResetToken, session)

    async def get_by_token_hash(self, token_hash: str) -> PasswordResetToken | None:
        stmt = select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_latest_for_account(
        self, account_id: str
    ) -> PasswordResetToken | None:
        """가장 최근 발급된 토큰 (rate limit 체크용)"""
        stmt = (
            select(PasswordResetToken)
            .where(
                PasswordResetToken.account_id == account_id,
                PasswordResetToken.deleted_at.is_(None),
            )
            .order_by(desc(PasswordResetToken.created_at))
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
