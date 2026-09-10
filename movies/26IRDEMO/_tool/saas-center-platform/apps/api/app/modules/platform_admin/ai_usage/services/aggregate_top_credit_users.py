from app.modules.platform_admin.ai_usage.repository import AdminAiUsageRepository


class AggregateTopCreditUsersService:
    def __init__(
        self,
        repo: AdminAiUsageRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        limit: int = 10,
    ) -> list[dict]:
        # return
        return await self.repo.aggregate_top_credit_users(limit=limit)
