from app.modules.subscription.subscription_payment.repository import (
    SubscriptionPaymentRepository,
)


class GetSubscriptionPaymentStatsService:
    def __init__(
        self,
        repo: SubscriptionPaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        year: int,
        month: int,
    ) -> tuple[int, int, dict[str, int]]:
        # load
        failed_count = await self.repo.count_failed_all_centers()
        confirmed_sum = await self.repo.aggregate_confirmed_amount_all_centers(
            year=year,
            month=month,
        )
        revenue_by_plan = await self.repo.aggregate_confirmed_by_plan_all_centers(
            year=year,
            month=month,
        )

        # return
        return failed_count, confirmed_sum, revenue_by_plan
