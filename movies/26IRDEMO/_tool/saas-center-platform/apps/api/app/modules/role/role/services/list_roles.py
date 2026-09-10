from ..repository import RoleRepository
from ..models import Role


class ListRolesService:
    def __init__(self, repo: RoleRepository):
        self.repo = repo

    async def execute(self) -> list[Role]:
        # return
        return await self.repo.list_all()
