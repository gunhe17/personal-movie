from app.modules.subscription.subscription.repository import SubscriptionRepository


class CountScheduledDowngradesService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(self) -> int:
        # return
        return await self.repo.count_scheduled_downgrades_all_centers()
