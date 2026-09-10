from app.modules.platform_admin.center.repository import AdminCenterRepository


class ListAdminMemberIdsService:
    def __init__(self, repo: AdminCenterRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
    ) -> list[str]:
        # return
        return await self.repo.list_admin_member_ids(center_id)
