from app.modules.subscription.subscription_payment.models import SubscriptionPayment
from app.modules.subscription.subscription_payment.repository import (
    SubscriptionPaymentRepository,
)


class FindSubscriptionPaymentService:
    def __init__(
        self,
        repo: SubscriptionPaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        toss_order_id: str,
    ) -> SubscriptionPayment | None:
        # return
        return await self.repo.find_by_order_id(toss_order_id=toss_order_id)
