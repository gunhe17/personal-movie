from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.repository import SubscriptionRepository


class ListRollCandidatesService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(self) -> list[Subscription]:
        # return
        return await self.repo.list_roll_candidates_all_centers()
