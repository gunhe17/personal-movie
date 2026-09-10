from app.modules.subscription.subscription_payment.models import SubscriptionPayment
from app.modules.subscription.subscription_payment.repository import (
    SubscriptionPaymentRepository,
)


class GetSubscriptionPaymentForUpdateService:
    def __init__(
        self,
        repo: SubscriptionPaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        payment_id: str,
    ) -> SubscriptionPayment:
        # return
        return await self.repo.get_for_update(payment_id=payment_id)
