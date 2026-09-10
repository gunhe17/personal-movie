from datetime import datetime

from app.core.datetime_utils import to_utc_naive, utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.billing.payment.events import PaymentAtomic
from app.modules.billing.payment.models import Payment, PaymentMethod
from app.modules.billing.payment.repository import PaymentRepository


class CreatePaymentService:
    def __init__(
        self,
        repo: PaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        billable_id: str,
        amount: int,
        payment_method: PaymentMethod,
        paid_at: datetime,
        receipt_number: str | None,
        memo: str | None,
        account_id: str,
        billable_status: str,
        billable_unpaid_amount: int,
    ) -> tuple[PaymentAtomic, Payment]:
        # verify (청구서는 facade가 로드 — primitive 수취)
        if billable_status == "paid":
            raise InvalidOperationException("이미 완납된 청구서입니다")

        # 과오납 방지: 결제 금액이 미수금을 초과하면 거부
        if amount <= 0:
            raise InvalidOperationException("결제 금액은 0원보다 커야 합니다")
        if amount > billable_unpaid_amount:
            raise InvalidOperationException(
                f"결제 금액({amount:,}원)이 미수금({billable_unpaid_amount:,}원)을 초과할 수 없습니다"
            )

        # 영수증 번호 자동 생성 (미입력 시)
        if not receipt_number:
            now = utc_now()
            seq = await self.repo.next_receipt_seq(billable_id=billable_id)
            receipt_number = f"{now.strftime('%Y%m%d')}-{seq:03d}"

        # 결제 생성
        payment = await self.repo.add(
            billable_id=billable_id,
            amount=amount,
            payment_method=payment_method,
            paid_at=to_utc_naive(paid_at),
            receipt_number=receipt_number,
            memo=memo,
            created_by=account_id,
        )
        return PaymentAtomic.created(payment=payment)
