from app.core.exceptions import InvalidOperationException
from ..repository import RoleRepository
from ..models import Role
from ..events import RoleAtomic
from ...role_permission.config import DEFAULT_ROLE_PERMISSIONS

PRESET_ROLE_CODES = set(DEFAULT_ROLE_PERMISSIONS.keys())


class DeleteRoleService:
    def __init__(self, repo: RoleRepository):
        self.repo = repo

    async def execute(
        self,
        role_id: str,
        center_id: str,
    ) -> tuple[RoleAtomic, Role]:
        # load
        role = await self.repo.get_in_center(id=role_id, center_id=center_id)

        # verify
        if role.code in PRESET_ROLE_CODES:
            raise InvalidOperationException(
                f"프리셋 역할({role.code})은 삭제할 수 없습니다."
            )

        # mutate
        removed = await self.repo.remove_in_center(id=role_id, center_id=center_id)

        # return
        return RoleAtomic.deleted(role=removed if removed is not None else role)
