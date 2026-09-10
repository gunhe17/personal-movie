from app.modules.subscription.subscription.repository import SubscriptionRepository


class GetSubscriptionStatsService:
    # 플랜별 분포 + 쿼터 초과 수 조회.

    def __init__(self, repo: SubscriptionRepository):
        self.repo = repo

    async def execute(self) -> tuple[dict[str, int], int]:
        by_plan = await self.repo.aggregate_plan_distribution_all_centers()
        exceeded = await self.repo.count_quota_exceeded_all_centers()
        return by_plan, exceeded
