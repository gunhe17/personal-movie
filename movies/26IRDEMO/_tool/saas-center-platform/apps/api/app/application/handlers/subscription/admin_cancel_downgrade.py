from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def admin_cancel_downgrade_handler(
    *,
    center_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> SubscriptionResponse:
    facade = SubscriptionFacade(uow)
    atomic, result = await facade.cancel_downgrade_with_response(
        center_id=center_id,
    )
    await emit(
        uow,
        "subscription_downgrade_cancelled",
        event_group_id=event_group_id,
        atomics=[
            atomic,
            AdminAuditAtomic(
                _act="downgrade_cancelled",
                _entity_name="subscription",
                _entity_id=center_id,
                _payload={"data": {"id": center_id}},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    return result


TOOL = {
    "name": "admin_cancel_downgrade_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영자가 예약된 다운그레이드를 취소한다.",
    "keywords": ["다운그레이드 취소", "강등 취소", "admin cancel downgrade"],
    "boundaries": "운영자 전용 — 예약 다운그레이드 취소. 예약은 admin_reserve_downgrade_handler.",
    "output": "다운그레이드 예약 취소 후 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "다운그레이드 예약을 취소할 센터의 UUID.",
            },
        },
        "required": ["center_id"],
    },
}
