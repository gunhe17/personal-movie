from dataclasses import dataclass

from app.core.type import uuid_str

from .models import SubscriptionPayment


@dataclass(frozen=True, kw_only=True)
class SubscriptionPaymentAtomic:
    _act: str
    payment: SubscriptionPayment

    @classmethod
    def of(
        cls,
        *,
        act: str,
        payment: SubscriptionPayment,
    ) -> tuple["SubscriptionPaymentAtomic", SubscriptionPayment]:
        return cls(_act=act, payment=payment), payment

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "subscription_payment"

    def act_entity_id(self) -> uuid_str:
        return self.payment.id

    def payload(self) -> dict:
        # 결제 금액·플랜·상태만 — toss raw_response(민감·거대)는 audit에 싣지 않는다.
        return {
            "data": {
                "id": self.payment.id,
                "plan": self.payment.plan,
                "amount": self.payment.amount,
                "status": self.payment.status,
                "order_id": self.payment.toss_order_id,
            }
        }
