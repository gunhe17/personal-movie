from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Payment
from .schemas import PaymentResponse


@dataclass(frozen=True, kw_only=True)
class PaymentAtomic:
    _act: str
    payment: Payment

    @classmethod
    def created(cls, *, payment: Payment) -> tuple["PaymentAtomic", Payment]:
        return cls(_act="created", payment=payment), payment

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "payment"

    def act_entity_id(self) -> uuid_str:
        return self.payment.id

    def payload(self) -> dict:
        dump = PaymentResponse.model_validate(self.payment).model_dump(mode="json")
        return {"data": dump}
