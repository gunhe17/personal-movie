from app.core.exceptions import EntityNotFoundException
from app.core.type import typecheck, unset, utc_dt, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import PersonProfile


class PersonProfileRepository(PostgresRepository[PersonProfile]):
    model = PersonProfile

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        member_id: uuid_str,
        content: dict,
        version: int = 0,
        analyzed_at: utc_dt | None = None,
    ) -> PersonProfile:
        return await super().add(
            PersonProfile(
                center_id=center_id,
                member_id=member_id,
                content=content,
                version=version,
                analyzed_at=analyzed_at,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        id: uuid_str,
        center_id: uuid_str,
        *,
        content: dict = unset,
        version: int = unset,
        analyzed_at: utc_dt | None = unset,
    ) -> PersonProfile:
        await self.get_in_center(id=id, center_id=center_id)
        updated = await self.update_fields(
            id, content=content, version=version, analyzed_at=analyzed_at
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def find_by_member(
        self,
        center_id: uuid_str,
        member_id: uuid_str,
    ) -> PersonProfile | None:
        return await self._find(
            where=[
                PersonProfile.center_id == center_id,
                PersonProfile.member_id == member_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        id: uuid_str,
        center_id: uuid_str,
    ) -> PersonProfile:
        found = await self._find(
            where=[PersonProfile.id == id, PersonProfile.center_id == center_id]
        )
        if found is None:
            raise EntityNotFoundException(f"PersonProfile not found: {id}")
        return found
