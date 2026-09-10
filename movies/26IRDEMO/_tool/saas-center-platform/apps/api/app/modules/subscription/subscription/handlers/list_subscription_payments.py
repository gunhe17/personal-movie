from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionPaymentSummary


async def list_subscription_payments_handler(
    center_id: str,
    *,
    limit: int = 20,
    uow: UnitOfWork,
) -> list[SubscriptionPaymentSummary]:
    facade = SubscriptionFacade(uow)
    return await facade.list_payments(center_id, limit=limit)


TOOL = {
    "name": "list_subscription_payments_handler",
    "permission": None,
    "purpose": "센터의 구독 결제 내역을 조회한다.",
    "keywords": ["결제 내역", "구독 결제 목록", "payments"],
    "boundaries": "센터 자기 결제 내역(읽기). 운영자용 목록은 admin_list_payments_handler.",
    "output": "결제 내역 목록 (SubscriptionPaymentSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "결제 내역을 조회할 센터의 UUID.",
            },
            "limit": {
                "type": "integer",
                "title": "개수",
                "description": "가져올 개수(기본 20).",
            },
        },
        "required": ["center_id"],
    },
}
