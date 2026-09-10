from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import (
    SubscriptionResponse,
    TransitionStatusRequest,
)


async def transition_status_handler(
    *,
    center_id: str,
    data: TransitionStatusRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> SubscriptionResponse:
    facade = SubscriptionFacade(uow)
    atomic, result = await facade.transition_status_with_response(
        center_id=center_id,
        target_status=data.status,
        actor_type="admin",
        reason=data.reason,
        force=data.force,
    )
    await emit(
        uow,
        "subscription_status_transitioned",
        event_group_id=event_group_id,
        atomics=[
            atomic,
            AdminAuditAtomic(
                _act="status_transitioned",
                _entity_name="subscription",
                _entity_id=center_id,
                _payload={
                    "data": {
                        "target_status": data.status,
                        "reason": data.reason,
                        "force": data.force,
                    }
                },
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    return result


TOOL = {
    "name": "transition_status_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영자가 구독 상태를 전이시킨다.",
    "keywords": ["구독 상태 변경", "상태 전이", "transition status"],
    "boundaries": "운영자 전용 — 구독 '상태' 강제 전이. 요금제 변경은 request_plan_change_handler.",
    "output": "상태 전이 후 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "구독 상태를 전이할 센터의 UUID.",
            },
            "status": {
                "title": "전이 상태",
                "type": "string",
                "description": "전이할 목표 구독 상태.",
            },
            "reason": {
                "title": "사유",
                "type": "string",
                "description": "상태 전이 사유.",
            },
            "force": {
                "default": False,
                "title": "강제 전이",
                "type": "boolean",
                "description": "true면 상태 전이 규칙 검증을 무시하고 강제(기본 False).",
            },
        },
        "required": ["center_id", "status", "reason"],
    },
}
