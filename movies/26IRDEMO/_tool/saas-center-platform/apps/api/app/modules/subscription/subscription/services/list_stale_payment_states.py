from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.repository import SubscriptionRepository


class ListStalePaymentStatesService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        stale_days: int,
    ) -> list[Subscription]:
        # return
        return await self.repo.list_stale_payment_states_all_centers(
            stale_days=stale_days,
        )
