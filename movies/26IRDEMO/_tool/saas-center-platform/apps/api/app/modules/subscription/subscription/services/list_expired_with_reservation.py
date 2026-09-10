from app.modules.subscription.subscription.models import Subscription
from app.modules.subscription.subscription.repository import SubscriptionRepository


class ListExpiredWithReservationService:
    def __init__(
        self,
        repo: SubscriptionRepository,
    ):
        self.repo = repo

    async def execute(self) -> list[Subscription]:
        # return
        return await self.repo.list_expired_with_reservation_all_centers()
