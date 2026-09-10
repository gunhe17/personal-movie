from app.core.exceptions import InvalidOperationException

from ...role.events import RoleAtomic
from ...role.models import Role, RoleCode
from ..repository import RolePermissionRepository
from ..schemas import AssignRolePermissionsCommand


class AssignRolePermissionsService:
    def __init__(
        self,
        repo: RolePermissionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        role: Role,
        command: AssignRolePermissionsCommand,
    ) -> tuple[RoleAtomic | None, Role]:
        # verify
        if role.code == RoleCode.ADMIN.value:
            raise InvalidOperationException(
                "관리자 역할의 권한은 변경할 수 없습니다."
            )

        # load — 같은 집합이면 사실 없음: atomic 없이 통과(emit이 None을 거른다)
        current = await self.repo.list_permissions_by_role(role_id=role.id)
        if {p.id for p in current} == set(command.permission_ids):
            return None, role

        # mutate
        await self.repo.assign_permissions(
            role_id=role.id,
            permission_ids=command.permission_ids,
        )

        # return
        return RoleAtomic.updated(
            role=role,
            changed={"permission_ids": command.permission_ids},
        )
