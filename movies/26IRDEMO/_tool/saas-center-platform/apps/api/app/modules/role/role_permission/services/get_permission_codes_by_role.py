from ..repository import RolePermissionRepository


class GetPermissionCodesByRoleService:
    def __init__(self, repo: RolePermissionRepository):
        self.repo = repo

    async def execute(self, role_id: str) -> list[str]:
        # return
        return await self.repo.list_permission_codes_by_role(role_id=role_id)
