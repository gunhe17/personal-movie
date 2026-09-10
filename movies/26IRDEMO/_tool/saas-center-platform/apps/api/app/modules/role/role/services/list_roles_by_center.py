from ..repository import RoleRepository
from ..models import Role


class ListRolesByCenterService:
    def __init__(self, repo: RoleRepository):
        self.repo = repo

    async def execute(self, center_id: str) -> list[Role]:
        # return
        return await self.repo.list_by_center(center_id=center_id)
