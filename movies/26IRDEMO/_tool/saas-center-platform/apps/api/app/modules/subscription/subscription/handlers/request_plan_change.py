from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def request_plan_change_handler(
    center_id: str,
    target_plan: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> SubscriptionResponse:
    facade = SubscriptionFacade(uow)
    atomic, result = await facade.request_plan_change_with_response(
        center_id=center_id,
        target_plan=target_plan,
    )
    await emit(
        uow,
        "subscription_plan_change_requested",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": "request_plan_change_handler",
    "permission": None,
    "purpose": "센터가 요금제 변경을 요청한다.",
    "keywords": ["요금제 변경 요청", "플랜 변경 신청", "request plan change"],
    "boundaries": "센터가 요금제 변경을 '요청'. 운영자 승인/반려는 application의 approve_plan_change·reject_plan_change_handler.",
    "output": "요금제 변경 요청 후 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {'type': 'string', 'format': 'uuid', 'title': '대상 센터', 'description': '요금제 변경을 요청할 센터의 UUID.'},
            "target_plan": {'type': 'string', 'title': '목표 요금제', 'description': '변경할 목표 요금제.'},
        },
        "required": ["center_id", "target_plan"],
    },
}
