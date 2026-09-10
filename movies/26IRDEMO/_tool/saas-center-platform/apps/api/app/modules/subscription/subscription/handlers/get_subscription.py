from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def get_subscription_handler(
    center_id: str,
    uow: UnitOfWork,
) -> SubscriptionResponse:
    facade = SubscriptionFacade(uow)
    return await facade.get_subscription_with_response(center_id)


TOOL = {
    "name": "get_subscription_handler",
    "permission": None,
    "purpose": "센터의 현재 구독 정보를 조회한다.",
    "keywords": ["구독 조회", "현재 요금제", "my subscription"],
    "boundaries": "센터 현재 구독(읽기). 요금제 목록은 get_plans_handler.",
    "output": "구독 상세 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "구독 정보를 조회할 센터의 UUID.",
            },
        },
        "required": ["center_id"],
    },
}
