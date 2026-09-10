from ..repository import RoleRepository
from ..models import Role


class GetRoleService:
    def __init__(self, repo: RoleRepository):
        self.repo = repo

    async def execute(self, role_id: str) -> Role:
        # return
        return await self.repo.get_by_id(role_id)
