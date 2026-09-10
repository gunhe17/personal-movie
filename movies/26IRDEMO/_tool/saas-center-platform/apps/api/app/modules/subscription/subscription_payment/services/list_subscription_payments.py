from app.modules.subscription.subscription_payment.models import SubscriptionPayment
from app.modules.subscription.subscription_payment.repository import (
    SubscriptionPaymentRepository,
)


class ListSubscriptionPaymentsService:
    def __init__(
        self,
        repo: SubscriptionPaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        limit: int = 20,
    ) -> list[SubscriptionPayment]:
        # return
        return await self.repo.list_in_center(
            center_id=center_id,
            limit=limit,
        )
