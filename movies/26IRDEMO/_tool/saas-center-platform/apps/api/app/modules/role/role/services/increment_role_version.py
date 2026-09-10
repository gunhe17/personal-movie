from ..events import RoleAtomic
from ..models import Role
from ..repository import RoleRepository


class IncrementRoleVersionService:
    # 권한 변경 후 버전 증가 = 권한 캐시/토큰 무효화 사건 (auth increment_token_version 선례)
    def __init__(
        self,
        repo: RoleRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        role_id: str,
    ) -> tuple[RoleAtomic, Role]:
        # mutate
        updated = await self.repo.increment_version(id=role_id)
        assert updated is not None

        # return
        return RoleAtomic.version_incremented(role=updated)
