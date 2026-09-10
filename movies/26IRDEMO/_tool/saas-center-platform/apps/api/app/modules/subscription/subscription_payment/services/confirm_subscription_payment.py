import json

from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.subscription.subscription_payment.events import SubscriptionPaymentAtomic
from app.modules.subscription.subscription_payment.models import SubscriptionPayment
from app.modules.subscription.subscription.plan_config import PaymentStatus
from app.modules.subscription.subscription_payment.repository import SubscriptionPaymentRepository


class ConfirmSubscriptionPaymentService:
    def __init__(self, payment_repo: SubscriptionPaymentRepository):
        self.repo = payment_repo

    async def execute(
        self,
        order_id: str,
        payment_key: str,
        amount: int,
        toss_response: dict,
    ) -> tuple[SubscriptionPaymentAtomic, SubscriptionPayment]:
        # load
        payment = await self.repo.get_by_order_id(toss_order_id=order_id)

        # verify
        if payment.status != PaymentStatus.PENDING:
            raise InvalidOperationException(
                f"결제 상태가 {payment.status}입니다. pending 상태만 확인 가능합니다."
            )

        if payment.amount != amount:
            raise InvalidOperationException(
                f"결제 금액 불일치: 예상 {payment.amount}원, 실제 {amount}원"
            )

        # update
        confirmed = await self.repo.update_payment(
            payment_id=payment.id,
            status=PaymentStatus.CONFIRMED,
            toss_payment_key=payment_key,
            method=toss_response.get("method", None),
            paid_at=utc_now(),
            raw_response=json.dumps(toss_response, ensure_ascii=False),
        )

        # return
        return SubscriptionPaymentAtomic.of(act="confirmed", payment=confirmed)
