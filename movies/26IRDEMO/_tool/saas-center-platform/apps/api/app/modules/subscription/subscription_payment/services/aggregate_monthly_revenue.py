from app.modules.subscription.subscription_payment.repository import (
    SubscriptionPaymentRepository,
)


class AggregateMonthlyRevenueService:
    def __init__(
        self,
        repo: SubscriptionPaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        months: int = 6,
    ) -> list[dict]:
        # return
        return await self.repo.aggregate_monthly_revenue_all_centers(months=months)
