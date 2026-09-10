from ..repository import RolePermissionRepository
from ...role.events import RoleAtomic
from ...role.models import Role


class CopyRolePermissionsFromGlobalService:
    def __init__(self, repo: RolePermissionRepository):
        self.repo = repo

    async def execute(
        self,
        global_role_id: str,
        center_role: Role,
    ) -> tuple[RoleAtomic, Role]:
        # return
        await self.repo.copy_permissions(
            source_role_id=global_role_id,
            target_role_id=center_role.id,
        )
        return RoleAtomic.updated(
            role=center_role,
            changed={"permissions_copied_from_role_id": global_role_id},
        )
