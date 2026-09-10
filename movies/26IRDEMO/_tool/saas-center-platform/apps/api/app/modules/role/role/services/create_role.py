from ..repository import RoleRepository
from ..models import Role, RoleAccessLevel
from ..events import RoleAtomic


class CreateRoleService:
    def __init__(self, repo: RoleRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        code: str,
        name: str,
        center_id: str | None = None,
        description: str | None = None,
        access_level: RoleAccessLevel = RoleAccessLevel.OWN,
    ) -> tuple[RoleAtomic, Role]:
        # return
        role = await self.repo.add(
            code=code,
            name=name,
            center_id=center_id,
            description=description,
            access_level=access_level,
        )
        return RoleAtomic.created(role=role)
