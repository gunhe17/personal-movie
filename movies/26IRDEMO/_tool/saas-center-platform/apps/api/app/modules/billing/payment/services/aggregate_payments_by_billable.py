from app.modules.billing.payment.repository import PaymentRepository


class AggregatePaymentsByBillableService:
    def __init__(
        self,
        repo: PaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        billable_id: str,
    ) -> int:
        return await self.repo.aggregate_by_billable(billable_id=billable_id)
