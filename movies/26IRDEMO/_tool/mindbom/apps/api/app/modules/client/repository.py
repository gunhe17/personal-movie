"""Client Repository"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.client.models import Client


class ClientRepository(BaseRepository[Client]):
    def __init__(self, session: AsyncSession):
        super().__init__(Client, session)

    async def list_by_institution(
        self,
        institution_id: str,
        *,
        skip: int = 0,
        limit: int = 20,
        search: str | None = None,
        status: str | None = None,
        gender: str | None = None,
    ) -> list[Client]:
        stmt = select(Client).where(
            Client.institution_id == institution_id,
            Client.deleted_at.is_(None),
        )

        if status:
            stmt = stmt.where(Client.status == status)
        if gender:
            stmt = stmt.where(Client.gender == gender)
        if search:
            stmt = stmt.where(Client.name.ilike(f"%{search}%"))

        stmt = stmt.order_by(Client.created_at.desc()).offset(skip).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_institution(
        self,
        institution_id: str,
        *,
        search: str | None = None,
        status: str | None = None,
        gender: str | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(Client).where(
            Client.institution_id == institution_id,
            Client.deleted_at.is_(None),
        )

        if status:
            stmt = stmt.where(Client.status == status)
        if gender:
            stmt = stmt.where(Client.gender == gender)
        if search:
            stmt = stmt.where(Client.name.ilike(f"%{search}%"))

        result = await self._session.execute(stmt)
        return result.scalar_one()
