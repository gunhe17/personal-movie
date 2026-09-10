"""Institution Repository"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.institution.models import Institution


class InstitutionRepository(BaseRepository[Institution]):
    def __init__(self, session: AsyncSession):
        super().__init__(Institution, session)
