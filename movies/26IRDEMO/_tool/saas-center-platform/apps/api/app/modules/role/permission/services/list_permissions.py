from ..repository import PermissionRepository
from ..models import Permission


class ListPermissionsService:
    def __init__(self, repo: PermissionRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        category: str | None = None,
        is_new: bool | None = None,
    ) -> list[Permission]:
        # return
        if category:
            return await self.repo.list_by_category(category=category)
        elif is_new:
            return await self.repo.list_new()
        else:
            return await self.repo.list_all()
