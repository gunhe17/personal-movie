from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def reject_plan_change_handler(
    *,
    center_id: str,
    reason: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> SubscriptionResponse:
    facade = SubscriptionFacade(uow)
    atomic, result = await facade.reject_plan_change_with_response(
        center_id=center_id,
        reason=reason,
    )
    await emit(
        uow,
        "subscription_plan_change_rejected",
        event_group_id=event_group_id,
        atomics=[
            atomic,
            AdminAuditAtomic(
                _act="plan_change_rejected",
                _entity_name="subscription",
                _entity_id=center_id,
                _payload={"data": {"reason": reason}},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    return result


TOOL = {
    "name": "reject_plan_change_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영자가 요금제 변경 요청을 반려한다.",
    "keywords": ["요금제 변경 반려", "플랜 변경 거절", "reject plan change"],
    "boundaries": "운영자 전용 — 요금제 변경 요청 반려. 요청은 request_plan_change_handler.",
    "output": "요금제 변경 반려 후 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "요금제 변경 요청을 반려할 센터의 UUID.",
            },
            "reason": {
                "type": "string",
                "title": "반려 사유",
                "description": "요금제 변경 반려 사유.",
            },
        },
        "required": ["center_id", "reason"],
    },
}
