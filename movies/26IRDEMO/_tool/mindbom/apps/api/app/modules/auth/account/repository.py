"""Account Repository"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.auth.account.models import Account


class AccountRepository(BaseRepository[Account]):
    def __init__(self, session: AsyncSession):
        super().__init__(Account, session)

    async def get_by_email(self, email: str) -> Account | None:
        stmt = select(Account).where(
            Account.email == email,
            Account.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
