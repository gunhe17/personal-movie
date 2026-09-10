from ..repository import RolePermissionRepository
from ...permission.models import Permission


class GetRolePermissionsService:
    def __init__(self, repo: RolePermissionRepository):
        self.repo = repo

    async def execute(self, role_id: str) -> list[Permission]:
        # return
        return await self.repo.list_permissions_by_role(role_id=role_id)
