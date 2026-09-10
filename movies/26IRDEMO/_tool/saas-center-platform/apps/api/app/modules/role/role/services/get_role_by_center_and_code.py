from ..models import Role
from ..repository import RoleRepository


class GetRoleByCenterAndCodeService:
    def __init__(self, repo: RoleRepository):
        self.repo = repo

    async def execute(self, center_id: str, code: str) -> Role:
        # return
        return await self.repo.get_by_center_and_code(center_id, code)
