from sqlalchemy import func
from sqlalchemy import update as sql_update

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Role, RoleAccessLevel


class RoleRepository(PostgresRepository[Role]):
    model = Role

    # #
    # command

    @typecheck
    async def add(
        self,
        *,
        code: str,
        name: str,
        center_id: uuid_str | None = None,
        description: str | None = None,
        access_level: RoleAccessLevel = RoleAccessLevel.OWN,
    ) -> Role:
        return await super().add(
            Role(
                center_id=center_id,
                code=code,
                name=name,
                description=description,
                access_level=access_level,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        description: str | None = unset,
        access_level: RoleAccessLevel = unset,
        version: int = unset,
    ) -> Role:
        await self.get_by_id(id)
        updated = await self.update_fields(
            id,
            name=name,
            description=description,
            access_level=access_level,
            version=version,
        )
        assert updated is not None
        return updated

    @typecheck
    async def increment_version(self, id: uuid_str) -> Role | None:
        role = (
            (
                await self._session.execute(
                    sql_update(Role)
                    .where(Role.id == id, Role.deleted_at.is_(None))
                    .values(version=Role.version + 1)
                    .returning(Role)
                )
            )
            .scalars()
            .first()
        )
        await self._session.flush()
        return role

    @typecheck
    async def update_with_version_guard(
        self,
        id: uuid_str,
        *,
        expected_version: int,
        name: str = unset,
        description: str | None = unset,
        access_level: RoleAccessLevel = unset,
    ) -> Role | None:
        fields = {
            k: v
            for k, v in {
                "name": name,
                "description": description,
                "access_level": access_level,
            }.items()
            if v is not unset
        }
        stmt = (
            sql_update(Role)
            .where(
                Role.id == id,
                Role.version == expected_version,
                Role.deleted_at.is_(None),
            )
            .values(**fields, version=Role.version + 1, updated_at=func.now())
            .returning(Role)
        )
        role = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return role

    @typecheck
    async def remove_in_center(self, id: uuid_str, center_id: uuid_str) -> Role | None:
        found = await self._find(where=[Role.id == id, Role.center_id == center_id])
        if found is None:
            return None
        return await self.remove_by_id(id)

    # #
    # query

    @typecheck
    async def get_in_center(self, id: uuid_str, center_id: uuid_str) -> Role:
        role = await self._find(where=[Role.id == id, Role.center_id == center_id])
        if role is None:
            raise EntityNotFoundException(f"Role을 찾을 수 없습니다: {id}")
        return role

    @typecheck
    async def find_by_center_and_code(
        self,
        center_id: uuid_str,
        code: str,
    ) -> Role | None:
        return await self._find(
            where=[Role.center_id == center_id, Role.code == code],
        )

    @typecheck
    async def get_by_center_and_code(
        self,
        center_id: uuid_str,
        code: str,
    ) -> Role:
        role = await self.find_by_center_and_code(center_id, code)
        if role is None:
            raise EntityNotFoundException(f"Role을 찾을 수 없습니다: {code}")
        return role

    @typecheck
    async def list_global(self) -> list[Role]:
        return await self._filter(
            where=[Role.center_id.is_(None)],
            order_by="code",
        )

    @typecheck
    async def list_by_center(self, center_id: uuid_str) -> list[Role]:
        return await self._filter(
            where=[Role.center_id == center_id],
            order_by="code",
        )

    @typecheck
    async def list_all(self) -> list[Role]:
        return await self._filter(order_by="code")

    @typecheck
    async def list_by_ids(self, role_ids: list[uuid_str]) -> list[Role]:
        if not role_ids:
            return []
        return await self._filter(where=[Role.id.in_(role_ids)])
