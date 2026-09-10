from app.core.type import typecheck, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import FamilyMember


class FamilyMemberRepository(PostgresRepository[FamilyMember]):
    model = FamilyMember

    # #
    # command

    @typecheck
    async def add(
        self,
        family_id: uuid_str,
        person_id: uuid_str,
        role: str = "owner",
    ) -> FamilyMember:
        return await super().add(
            FamilyMember(family_id=family_id, person_id=person_id, role=role)
        )

    # #
    # query

    @typecheck
    async def find_by_person(
        self,
        person_id: uuid_str,
    ) -> FamilyMember | None:
        return await self._find(where=[FamilyMember.person_id == person_id])

    @typecheck
    async def list_by_family(
        self,
        family_id: uuid_str,
    ) -> list[FamilyMember]:
        return await self._filter(where=[FamilyMember.family_id == family_id])
