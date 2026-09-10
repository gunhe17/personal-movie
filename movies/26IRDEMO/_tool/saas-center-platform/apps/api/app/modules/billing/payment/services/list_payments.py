from app.modules.billing.payment.models import Payment
from app.modules.billing.payment.repository import PaymentRepository


class ListPaymentsService:
    def __init__(
        self,
        repo: PaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        billable_id: str,
    ) -> tuple[list[Payment], int]:
        payments = await self.repo.list_by_billable(billable_id=billable_id)
        total_paid = await self.repo.aggregate_by_billable(billable_id=billable_id)
        return payments, total_paid
