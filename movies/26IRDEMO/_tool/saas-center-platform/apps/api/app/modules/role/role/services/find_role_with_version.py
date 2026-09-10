from ..repository import RoleRepository
from ..models import Role


class FindRoleWithVersionService:
    def __init__(self, repo: RoleRepository):
        self.repo = repo

    async def execute(self, role_id: str) -> Role | None:
        # return
        return await self.repo.find_by_id(role_id)
