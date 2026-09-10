from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade import PaymentFacade
from app.modules.billing.payment.schemas import PaymentCreate, PaymentResponse
from app.modules.event import emit


async def create_payment_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    account_id: str,
    billable_id: str,
    data: PaymentCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> PaymentResponse:
    facade = PaymentFacade(uow)
    atomics, payment = await facade.create_payment(
        billable_id=billable_id,
        center_id=center_id,
        data=data,
        account_id=account_id,
    )
    await emit(
        uow,
        "payment_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )
    return PaymentResponse.model_validate(payment)


TOOL = {
    "name": "create_payment_handler",
    "permission": "write:billing",
    "agent_exposed": False,  # 표면은 application create_payment_handler(동명 — 크로스모듈 조율 버전이 노출됨)
    "purpose": "청구 항목에 대한 결제 기록을 생성한다.",
    "keywords": ["결제 생성", "수납 등록", "payment 생성"],
    "boundaries": "청구(billable)에 대한 결제 '생성'. 결제 목록은 list_payments_handler.",
    "output": "생성된 결제 기록 (PaymentResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "billable_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 청구 항목",
                "description": "결제할 청구 항목의 UUID.",
            },
            "amount": {
                "description": "결제 금액(원).",
                "exclusiveMinimum": 0,
                "title": "결제 금액",
                "type": "integer",
            },
            "payment_method": {
                "$ref": "#/$defs/PaymentMethod",
                "description": "결제 수단: card(카드)/transfer(계좌이체).",
            },
            "paid_at": {
                "description": "결제 일시.",
                "format": "date-time",
                "title": "결제 일시",
                "type": "string",
            },
            "receipt_number": {
                "anyOf": [{"maxLength": 50, "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "영수증 번호(미입력 시 자동 생성).",
                "title": "영수증 번호",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "메모(선택).",
                "title": "메모",
            },
        },
        "$defs": {
            "PaymentMethod": {
                "enum": ["card", "transfer"],
                "title": "PaymentMethod",
                "type": "string",
            }
        },
        "required": ["billable_id", "amount", "payment_method", "paid_at"],
    },
}
