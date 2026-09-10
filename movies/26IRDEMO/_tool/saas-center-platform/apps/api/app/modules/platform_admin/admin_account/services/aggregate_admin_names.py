from app.modules.platform_admin.admin_account.repository import AdminAccountRepository


class AggregateAdminNamesService:
    def __init__(self, repo: AdminAccountRepository):
        self.repo = repo

    async def execute(
        self,
        ids: list,
    ) -> dict:
        # return
        return await self.repo.aggregate_name_map_by_ids(ids=ids)
