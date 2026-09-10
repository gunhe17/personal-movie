from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def admin_reserve_downgrade_handler(
    *,
    center_id: str,
    target_plan: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> SubscriptionResponse:
    facade = SubscriptionFacade(uow)
    atomic, result = await facade.reserve_downgrade_with_response(
        center_id=center_id,
        target_plan=target_plan,
    )
    await emit(
        uow,
        "subscription_downgrade_reserved",
        event_group_id=event_group_id,
        atomics=[
            atomic,
            AdminAuditAtomic(
                _act="downgrade_reserved",
                _entity_name="subscription",
                _entity_id=center_id,
                _payload={"data": {"target_plan": target_plan}},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    return result


TOOL = {
    "name": "admin_reserve_downgrade_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영자가 다운그레이드를 예약한다.",
    "keywords": ["다운그레이드 예약", "강등 예약", "schedule downgrade"],
    "boundaries": "운영자 전용 — 다운그레이드 '예약'. 취소는 admin_cancel_downgrade_handler.",
    "output": "다운그레이드 예약 후 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "다운그레이드를 예약할 센터의 UUID.",
            },
            "target_plan": {
                "type": "string",
                "title": "목표 요금제",
                "description": "내릴 목표 요금제.",
            },
        },
        "required": ["center_id", "target_plan"],
    },
}
