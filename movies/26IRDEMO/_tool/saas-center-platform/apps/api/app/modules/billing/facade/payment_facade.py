from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.payment.models import Payment
from app.modules.billing.payment.repository import PaymentRepository
from app.modules.billing.payment.schemas import (
    PaymentCreate,
    PaymentResponse,
    PaymentListResponse,
)
from app.modules.billing.billable.services.apply_payment_totals import (
    ApplyPaymentTotalsService,
)
from app.modules.billing.billable.services.get_billable_by_id import (
    GetBillableByIdService,
)
from app.modules.billing.payment.services.aggregate_payments_by_billable import (
    AggregatePaymentsByBillableService,
)
from app.modules.billing.payment.services.create_payment import CreatePaymentService
from app.modules.billing.payment.services.list_payments import ListPaymentsService


class PaymentFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _payment_repo(self) -> PaymentRepository:
        return self._uow.repo(PaymentRepository)

    def _billable_repo(self) -> BillableRepository:
        return self._uow.repo(BillableRepository)

    async def create_payment(
        self,
        *,
        billable_id: str,
        center_id: str,
        data: PaymentCreate,
        account_id: str,
    ) -> tuple[list, Payment]:
        billable = await GetBillableByIdService(self._billable_repo()).execute(
            billable_id=billable_id,
            center_id=center_id,
        )

        service = CreatePaymentService(self._payment_repo())
        atomic, payment = await service.execute(
            billable_id=billable_id,
            amount=data.amount,
            payment_method=data.payment_method,
            paid_at=data.paid_at,
            receipt_number=data.receipt_number,
            memo=data.memo,
            account_id=account_id,
            billable_status=billable.status,
            billable_unpaid_amount=billable.unpaid_amount,
        )

        total_paid = await AggregatePaymentsByBillableService(
            self._payment_repo()
        ).execute(billable_id=billable_id)
        billable_atomic, _ = await ApplyPaymentTotalsService(
            self._billable_repo()
        ).execute(
            billable_id,
            center_id,
            total_paid=total_paid,
            total_amount=billable.total_amount,
        )
        return [atomic, billable_atomic], payment

    async def list_payments_with_response(
        self,
        *,
        billable_id: str,
        center_id: str,
    ) -> PaymentListResponse:
        await GetBillableByIdService(self._billable_repo()).execute(
            billable_id=billable_id,
            center_id=center_id,
        )
        service = ListPaymentsService(self._payment_repo())
        payments, total_paid = await service.execute(billable_id)
        return PaymentListResponse(
            items=[PaymentResponse.model_validate(p) for p in payments],
            total_paid=total_paid,
        )
