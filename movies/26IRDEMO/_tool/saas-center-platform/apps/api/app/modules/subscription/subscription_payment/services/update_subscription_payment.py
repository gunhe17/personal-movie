from app.core.type import unset, utc_dt
from app.modules.subscription.subscription_payment.events import (
    SubscriptionPaymentAtomic,
)
from app.modules.subscription.subscription_payment.models import SubscriptionPayment
from app.modules.subscription.subscription_payment.repository import (
    SubscriptionPaymentRepository,
)


class UpdateSubscriptionPaymentService:
    def __init__(
        self,
        repo: SubscriptionPaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        payment_id: str,
        *,
        act: str = "updated",
        status: str = unset,
        toss_payment_key: str | None = unset,
        method: str | None = unset,
        paid_at: utc_dt | None = unset,
        failed_reason: str | None = unset,
        raw_response: str | None = unset,
    ) -> tuple[SubscriptionPaymentAtomic | None, SubscriptionPayment | None]:
        # update
        updated = await self.repo.update_payment(
            payment_id=payment_id,
            status=status,
            toss_payment_key=toss_payment_key,
            method=method,
            paid_at=paid_at,
            failed_reason=failed_reason,
            raw_response=raw_response,
        )

        # return (부재 = no-op, atomic 없음)
        if updated is None:
            return None, None
        return SubscriptionPaymentAtomic.of(act=act, payment=updated)
