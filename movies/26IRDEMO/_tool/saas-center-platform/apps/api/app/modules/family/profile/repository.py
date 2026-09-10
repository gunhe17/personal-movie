from datetime import date

from app.core.exceptions import EntityNotFoundException
from app.core.type import typecheck, unset, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Profile


class ProfileRepository(PostgresRepository[Profile]):
    model = Profile

    # #
    # command

    @typecheck
    async def add(
        self,
        family_id: uuid_str,
        display_name: str,
        relation: str = "child",
        birth_date: date | None = None,
        gender: str | None = None,
        image_url: str | None = None,
    ) -> Profile:
        return await super().add(
            Profile(
                family_id=family_id,
                display_name=display_name,
                relation=relation,
                birth_date=birth_date,
                gender=gender,
                image_url=image_url,
            )
        )

    @typecheck
    async def update_in_family(
        self,
        id: uuid_str,
        family_id: uuid_str,
        *,
        display_name: str = unset,
        birth_date: date | None = unset,
        gender: str | None = unset,
        image_url: str | None = unset,
    ) -> Profile:
        await self.get_in_family(id=id, family_id=family_id)
        updated = await self.update_fields(
            id,
            display_name=display_name,
            birth_date=birth_date,
            gender=gender,
            image_url=image_url,
        )
        assert updated is not None
        return updated

    @typecheck
    async def remove_in_family(
        self,
        id: uuid_str,
        family_id: uuid_str,
    ) -> Profile | None:
        await self.get_in_family(id=id, family_id=family_id)
        return await self.remove_by_id(id)

    # #
    # query

    @typecheck
    async def get_in_family(
        self,
        id: uuid_str,
        family_id: uuid_str,
    ) -> Profile:
        profile = await self._find(
            where=[Profile.id == id, Profile.family_id == family_id]
        )
        if profile is None:
            raise EntityNotFoundException(f"프로필을 찾을 수 없습니다: {id}")
        return profile

    @typecheck
    async def list_by_family(
        self,
        family_id: uuid_str,
    ) -> list[Profile]:
        return await self._filter(
            where=[Profile.family_id == family_id],
            order_by="created_at",
        )
