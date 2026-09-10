from ..repository import RoleRepository
from ..models import Role


class GetRolesByIdsService:
    def __init__(self, repo: RoleRepository):
        self.repo = repo

    async def execute(self, role_ids: list[str]) -> dict[str, Role]:
        if not role_ids:
            return {}

        # load
        roles = await self.repo.list_by_ids(role_ids=role_ids)

        # return
        return {role.id: role for role in roles}
