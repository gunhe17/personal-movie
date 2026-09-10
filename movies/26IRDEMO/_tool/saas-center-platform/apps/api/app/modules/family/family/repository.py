from app.core.exceptions import EntityNotFoundException
from app.core.type import typecheck, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Family


class FamilyRepository(PostgresRepository[Family]):
    model = Family

    # #
    # command

    @typecheck
    async def add(
        self,
        name: str | None = None,
    ) -> Family:
        return await super().add(Family(name=name))

    # #
    # query

    @typecheck
    async def get_by_id(
        self,
        id: uuid_str,
    ) -> Family:
        family = await self._find(where=[Family.id == id])
        if family is None:
            raise EntityNotFoundException(f"가족을 찾을 수 없습니다: {id}")
        return family
