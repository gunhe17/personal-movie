from sqlalchemy import func, select

from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import LabPromptVersion


class LabPromptVersionRepository(PostgresRepository[LabPromptVersion]):
    model = LabPromptVersion

    # #
    # command

    @typecheck
    async def add(
        self,
        prompt_key: str,
        version: int,
        name: str,
        system_prompt: str,
        user_prompt_template: str | None = None,
        author_id: uuid_str | None = None,
        is_active: bool = True,
        is_production: bool = False,
        description: str | None = None,
    ) -> LabPromptVersion:
        return await super().add(
            LabPromptVersion(
                prompt_key=prompt_key,
                version=version,
                name=name,
                system_prompt=system_prompt,
                user_prompt_template=user_prompt_template,
                author_id=author_id,
                is_active=is_active,
                is_production=is_production,
                description=description,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        system_prompt: str = unset,
        user_prompt_template: str | None = unset,
        is_active: bool = unset,
        description: str | None = unset,
    ) -> LabPromptVersion | None:
        return await self.update_fields(
            id,
            name=name,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
            is_active=is_active,
            description=description,
        )

    # #
    # query

    @typecheck
    async def list_all(
        self,
        *,
        limit: int = 200,
    ) -> list[LabPromptVersion]:
        return await self._filter(limit=limit)

    @typecheck
    async def list_by_key(
        self,
        prompt_key: str,
    ) -> list[LabPromptVersion]:
        return await self._filter(
            where=[LabPromptVersion.prompt_key == prompt_key],
            order_by="version",
            descending=True,
        )

    @typecheck
    async def next_version(
        self,
        prompt_key: str,
    ) -> int:
        stmt = (
            select(func.coalesce(func.max(LabPromptVersion.version), 0))
            .where(LabPromptVersion.prompt_key == prompt_key)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one() + 1

    @typecheck
    async def find_production_by_key(
        self,
        prompt_key: str,
    ) -> LabPromptVersion | None:
        return await self._find(
            where=[
                LabPromptVersion.prompt_key == prompt_key,
                LabPromptVersion.is_production.is_(True),
            ],
            order_by="version",
            descending=True,
        )
