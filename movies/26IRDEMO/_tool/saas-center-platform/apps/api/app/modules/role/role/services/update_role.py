from app.core.exceptions import ConflictException, InvalidOperationException
from app.core.type import unset
from ..repository import RoleRepository
from ..models import Role, RoleAccessLevel, RoleCode
from ..events import RoleAtomic
from ...role_permission.config import DEFAULT_ROLE_PERMISSIONS

PRESET_ROLE_CODES = set(DEFAULT_ROLE_PERMISSIONS.keys())


class UpdateRoleService:
    def __init__(self, repo: RoleRepository):
        self.repo = repo

    async def execute(
        self,
        role_id: str,
        *,
        changed: dict,
        name: str = unset,
        description: str | None = unset,
        access_level: RoleAccessLevel = unset,
        expected_version: int | None = None,
    ) -> tuple[RoleAtomic, Role]:
        # load
        role = await self.repo.get_by_id(role_id)

        # verify
        if role.code == RoleCode.ADMIN.value:
            raise InvalidOperationException(
                "관리자 역할은 수정할 수 없습니다."
            )
        if role.code in PRESET_ROLE_CODES and name is not unset and name != role.name:
            raise InvalidOperationException(
                f"프리셋 역할({role.code})의 이름은 변경할 수 없습니다."
            )
        # 프리셋 역할의 access_level은 고정 — 전달돼도 무시
        if role.code in PRESET_ROLE_CODES:
            access_level = unset

        # mutate
        if expected_version is not None:
            updated = await self.repo.update_with_version_guard(
                role_id,
                expected_version=expected_version,
                name=name,
                description=description,
                access_level=access_level,
            )
            if updated is None:
                raise ConflictException(
                    "역할이 다른 사용자에 의해 먼저 수정되었습니다. 새로고침 후 다시 시도하세요."
                )
            return RoleAtomic.updated(role=updated, changed=changed)

        updated = await self.repo.update_in_place(
            role_id,
            name=name,
            description=description,
            access_level=access_level,
            version=role.version + 1,
        )

        # return
        return RoleAtomic.updated(role=updated, changed=changed)
