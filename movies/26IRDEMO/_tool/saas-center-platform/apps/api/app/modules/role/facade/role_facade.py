from uuid import uuid4

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.type import unset
from .. import (
    AssignRolePermissionsService,
    CopyRolePermissionsFromGlobalService,
    CreateRoleService,
    DeleteRoleService,
    GetPermissionCodesByRoleService,
    FindRoleByCenterAndCodeService,
    GetRoleByCenterAndCodeService,
    GetRolePermissionsService,
    GetRoleService,
    GetRolesByIdsService,
    FindRoleWithVersionService,
    IncrementRoleVersionService,
    ListGlobalRolesService,
    ListRolesByCenterService,
    UpdateRoleService,
)
from ..role.repository import RoleRepository
from ..role_permission.repository import RolePermissionRepository
from ..role_permission.schemas import AssignRolePermissionsCommand
from ..role_permission.schemas import RolePermissionsResponse
from ..permission.schemas import PermissionSummary
from ..role.models import Role
from ..role.events import RoleAtomic
from ..role.models import RoleAccessLevel


class RoleFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def find_role_with_version(self, role_id: str) -> Role | None:
        role_repo = self._uow.repo(RoleRepository)
        service = FindRoleWithVersionService(role_repo)
        return await service.execute(role_id)

    async def assign_permissions(
        self,
        role_id: str,
        command: AssignRolePermissionsCommand,
    ) -> tuple[list[RoleAtomic], Role]:
        role_repo = self._uow.repo(RoleRepository)

        get_role_service = GetRoleService(role_repo)
        role = await get_role_service.execute(role_id)

        role_perm_repo = self._uow.repo(RolePermissionRepository)
        assign_service = AssignRolePermissionsService(role_perm_repo)
        atomic, role = await assign_service.execute(role, command)

        version_atomic, role = await IncrementRoleVersionService(role_repo).execute(
            role.id
        )
        return [atomic, version_atomic], role

    async def list_permission_codes_by_role(self, role_id: str) -> list[str]:
        repo = self._uow.repo(RolePermissionRepository)
        return await GetPermissionCodesByRoleService(repo).execute(role_id)

    async def get_role_with_permissions(self, role_id: str) -> dict:
        role_repo = self._uow.repo(RoleRepository)
        get_role_service = GetRoleService(role_repo)
        role = await get_role_service.execute(role_id)

        role_perm_repo = self._uow.repo(RolePermissionRepository)
        get_perms_service = GetRolePermissionsService(role_perm_repo)
        permissions = await get_perms_service.execute(role_id)

        return {
            "role": role,
            "permissions": permissions,
        }

    async def initialize_center_roles_and_permissions(
        self,
        center_id: str,
    ) -> tuple[list[RoleAtomic], int]:
        role_repo = self._uow.repo(RoleRepository)
        role_perm_repo = self._uow.repo(RolePermissionRepository)

        list_global_service = ListGlobalRolesService(role_repo)
        global_roles = await list_global_service.execute()

        create_role_service = CreateRoleService(role_repo)
        init_perm_service = CopyRolePermissionsFromGlobalService(role_perm_repo)

        atomics = []
        created_count = 0
        for global_role in global_roles:
            role_atomic, new_role = await create_role_service.execute(
                code=global_role.code,
                name=global_role.name,
                center_id=center_id,
                description=global_role.description,
                access_level=RoleAccessLevel(global_role.access_level),
            )

            permission_atomic, _ = await init_perm_service.execute(
                global_role.id, new_role
            )

            atomics.extend([role_atomic, permission_atomic])
            created_count += 1

        return atomics, created_count

    async def find_role_by_center_and_code(
        self, center_id: str, code: str
    ) -> Role | None:
        role_repo = self._uow.repo(RoleRepository)
        service = FindRoleByCenterAndCodeService(role_repo)
        return await service.execute(center_id, code)

    async def list_roles_by_center(self, center_id: str) -> list[Role]:
        role_repo = self._uow.repo(RoleRepository)
        service = ListRolesByCenterService(role_repo)
        return await service.execute(center_id)

    async def create_custom_role(
        self,
        center_id: str,
        name: str,
        description: str | None,
        permission_ids: list[int],
        access_level: RoleAccessLevel = RoleAccessLevel.OWN,
    ) -> tuple[list[RoleAtomic], Role]:
        role_repo = self._uow.repo(RoleRepository)
        role_perm_repo = self._uow.repo(RolePermissionRepository)

        code = uuid4().hex[:8].upper()

        create_service = CreateRoleService(role_repo)
        role_atomic, role = await create_service.execute(
            code=code,
            name=name,
            center_id=center_id,
            description=description,
            access_level=access_level,
        )

        permission_atomic = None
        if permission_ids:
            assign_service = AssignRolePermissionsService(role_perm_repo)
            command = AssignRolePermissionsCommand(permission_ids=permission_ids)
            permission_atomic, role = await assign_service.execute(role, command)

        return [role_atomic, *([permission_atomic] if permission_atomic else [])], role

    async def update_custom_role(
        self,
        center_id: str,
        role_code: str,
        *,
        changed: dict,
        permission_ids: list[int],
        name: str = unset,
        description: str | None = unset,
        access_level: RoleAccessLevel = unset,
        expected_version: int | None = None,
    ) -> tuple[list[RoleAtomic], Role]:
        role_repo = self._uow.repo(RoleRepository)
        role_perm_repo = self._uow.repo(RolePermissionRepository)

        role = await GetRoleByCenterAndCodeService(role_repo).execute(
            center_id, role_code
        )

        update_service = UpdateRoleService(role_repo)
        role_atomic, role = await update_service.execute(
            role.id,
            changed=changed,
            name=name,
            description=description,
            access_level=access_level,
            expected_version=expected_version,
        )

        assign_service = AssignRolePermissionsService(role_perm_repo)
        command = AssignRolePermissionsCommand(permission_ids=permission_ids)
        permission_atomic, role = await assign_service.execute(role, command)

        return [role_atomic, permission_atomic], role

    async def delete_custom_role(
        self,
        center_id: str,
        role_code: str,
    ) -> tuple[RoleAtomic, Role]:
        role_repo = self._uow.repo(RoleRepository)

        role = await GetRoleByCenterAndCodeService(role_repo).execute(
            center_id, role_code
        )

        delete_service = DeleteRoleService(role_repo)
        return await delete_service.execute(role.id, center_id)

    async def get_role_with_permissions_with_response(
        self, role_id: str
    ) -> RolePermissionsResponse:
        result = await self.get_role_with_permissions(role_id)
        role = result["role"]
        permissions = result["permissions"]
        return RolePermissionsResponse(
            role_id=role.id,
            role_code=role.code,
            role_name=role.name,
            access_level=role.access_level,
            permissions=[
                PermissionSummary.model_validate(p).model_dump() for p in permissions
            ],
        )

    async def get_roles_by_ids(self, role_ids: list[str]) -> dict[str, Role]:
        repo = self._uow.repo(RoleRepository)
        service = GetRolesByIdsService(repo)
        return await service.execute(role_ids)

    async def get_role_summaries_by_ids(self, role_ids: list[str]) -> dict[str, str]:
        if not role_ids:
            return {}
        role_map = await self.get_roles_by_ids(role_ids)
        return {rid: role.name for rid, role in role_map.items()}
