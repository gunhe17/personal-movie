from app.modules.subscription.subscription.plan_config import PaymentStatus
from app.core.exceptions import InvalidOperationException
from app.modules.subscription.subscription_payment.events import (
    SubscriptionPaymentAtomic,
)
from app.modules.subscription.subscription_payment.models import SubscriptionPayment
from app.modules.subscription.subscription_payment.repository import (
    SubscriptionPaymentRepository,
)


class CancelSubscriptionPaymentService:
    def __init__(
        self,
        repo: SubscriptionPaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        payment_id: str,
        cancel_reason: str,
    ) -> tuple[SubscriptionPaymentAtomic, SubscriptionPayment]:
        # load
        payment = await self.repo.get_for_update(payment_id=payment_id)

        # verify
        if payment.status != PaymentStatus.CONFIRMED:
            raise InvalidOperationException(
                f"확정된 결제만 취소할 수 있습니다 (현재 상태: {payment.status})"
            )

        # update
        updated = await self.repo.update_payment(
            payment_id=payment.id,
            status=PaymentStatus.CANCELLED,
            failed_reason=f"[취소] {cancel_reason}",
        )
        assert updated is not None

        # return
        return SubscriptionPaymentAtomic.of(act="cancelled", payment=updated)
