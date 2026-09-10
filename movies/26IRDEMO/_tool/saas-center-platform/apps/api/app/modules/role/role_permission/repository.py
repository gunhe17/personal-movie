from sqlalchemy import delete, select

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import RolePermission
from ..permission.models import Permission


class RolePermissionRepository(PostgresRepository[RolePermission]):
    model = RolePermission

    # #
    # command

    @typecheck
    async def assign_permissions(
        self,
        role_id: uuid_str,
        permission_ids: list[int],
    ) -> None:
        await self.hard_delete_by_role(role_id=role_id)
        self._session.add_all(
            RolePermission(role_id=role_id, permission_id=permission_id)
            for permission_id in permission_ids
        )
        await self._session.flush()

    @typecheck
    async def copy_permissions(
        self,
        source_role_id: uuid_str,
        target_role_id: uuid_str,
    ) -> None:
        permission_ids = await self._scalars(
            select(RolePermission.permission_id)
            .where(RolePermission.role_id == source_role_id)
            .where(RolePermission.deleted_at.is_(None))
        )
        if permission_ids:
            self._session.add_all(
                RolePermission(role_id=target_role_id, permission_id=permission_id)
                for permission_id in permission_ids
            )
            await self._session.flush()

    @typecheck
    async def hard_delete_by_role(self, role_id: uuid_str) -> None:
        await self._session.execute(
            delete(RolePermission).where(RolePermission.role_id == role_id)
        )
        await self._session.flush()

    # #
    # query

    @typecheck
    async def list_permissions_by_role(self, role_id: uuid_str) -> list[Permission]:
        return await self._scalars(
            select(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
            .where(RolePermission.deleted_at.is_(None))
            .where(Permission.deleted_at.is_(None))
            .order_by(Permission.category, Permission.code)
        )

    @typecheck
    async def list_permission_codes_by_role(self, role_id: uuid_str) -> list[str]:
        return await self._scalars(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
            .where(RolePermission.deleted_at.is_(None))
            .where(Permission.deleted_at.is_(None))
        )
