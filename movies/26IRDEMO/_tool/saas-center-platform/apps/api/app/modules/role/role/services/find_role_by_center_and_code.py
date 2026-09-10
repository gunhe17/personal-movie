from ..repository import RoleRepository
from ..models import Role


class FindRoleByCenterAndCodeService:
    def __init__(self, repo: RoleRepository):
        self.repo = repo

    async def execute(self, center_id: str, code: str) -> Role | None:
        # return
        return await self.repo.find_by_center_and_code(center_id=center_id, code=code)
