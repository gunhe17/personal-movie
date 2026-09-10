from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def upgrade_plan_handler(
    *,
    center_id: str,
    new_plan: str,
    actor_type: str = "admin",
    reason: str = "upgrade",
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> SubscriptionResponse:
    sub_facade = SubscriptionFacade(uow)
    subscription_atomic, response = await sub_facade.upgrade_with_response(
        center_id,
        new_plan,
        actor_type=actor_type,
        reason=reason,
    )

    # credit
    credit_facade = CreditFacade(uow)
    credit_atomic, _ = await credit_facade.initialize_credit(
        center_id=center_id,
        plan_type=new_plan,
        period_start=response.current_period_start,
        period_end=response.current_period_end,
    )

    await emit(
        uow,
        "subscription_upgraded",
        event_group_id=event_group_id,
        atomics=[
            subscription_atomic,
            credit_atomic,
            AdminAuditAtomic(
                _act="upgraded",
                _entity_name="subscription",
                _entity_id=center_id,
                _payload={"data": {"new_plan": new_plan, "reason": reason}},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return response


TOOL = {
    "name": "upgrade_plan_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "센터의 구독 요금제를 상위로 업그레이드한다.",
    "keywords": [
        "upgrade plan",
        "요금제 업그레이드",
        "플랜 상향",
        "구독 업그레이드",
        "upgrade",
        "상위 요금제",
    ],
    "boundaries": "요금제 '업그레이드' 시작. 결제 후 확정은 confirm_upgrade_handler, 일반 변경은 change_plan_handler.",
    "output": "업그레이드된 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "요금제를 업그레이드할 센터의 UUID.",
            },
            "new_plan": {
                "type": "string",
                "title": "새 요금제",
                "enum": ["free", "starter", "pro", "enterprise"],
                "description": "업그레이드할 요금제 코드.",
            },
            "reason": {
                "type": "string",
                "title": "사유",
                "description": "업그레이드 사유(선택).",
            },
        },
        "required": ["center_id", "new_plan"],
    },
}
