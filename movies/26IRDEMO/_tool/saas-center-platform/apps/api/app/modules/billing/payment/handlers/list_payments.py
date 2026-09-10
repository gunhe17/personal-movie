from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade import PaymentFacade
from app.modules.billing.payment.schemas import PaymentListResponse


async def list_payments_handler(
    center_id: str,
    billable_id: str,
    uow: UnitOfWork,
) -> PaymentListResponse:
    facade = PaymentFacade(uow)
    return await facade.list_payments_with_response(
        billable_id=billable_id,
        center_id=center_id,
    )


TOOL = {
    "name": "list_payments_handler",
    "permission": "read:billing",
    "purpose": "청구 항목의 결제 기록 목록을 조회한다.",
    "keywords": ["결제 목록", "수납 내역", "payment 목록"],
    "boundaries": "한 청구의 결제 목록(읽기). 생성은 create_payment_handler.",
    "output": "청구 항목의 결제 기록 목록 (PaymentListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "billable_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 청구 항목",
                "description": "결제 내역을 조회할 청구 항목의 UUID.",
            },
        },
        "required": ["billable_id"],
    },
}
