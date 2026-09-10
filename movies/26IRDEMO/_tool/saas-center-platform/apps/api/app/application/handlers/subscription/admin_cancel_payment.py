from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.payment.factory import get_toss_client
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionPaymentSummary


async def admin_cancel_payment_handler(
    *,
    center_id: str,
    payment_id: str,
    reason: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> SubscriptionPaymentSummary:
    facade = SubscriptionFacade(uow)
    atomic, result = await facade.cancel_payment_with_response(
        center_id=center_id,
        payment_id=payment_id,
        reason=reason,
        toss_client=get_toss_client(),
    )
    await emit(
        uow,
        "subscription_payment_cancelled",
        event_group_id=event_group_id,
        atomics=[
            atomic,
            AdminAuditAtomic(
                _act="cancelled",
                _entity_name="subscription_payment",
                _entity_id=payment_id,
                _payload={"data": {"center_id": center_id, "reason": reason}},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    return result


TOOL = {
    "name": "admin_cancel_payment_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영자가 결제를 취소(환불)한다.",
    "keywords": ["결제 취소", "환불", "admin cancel payment"],
    "boundaries": "운영자 전용 — 구독 결제 취소/환불.",
    "output": "취소된 결제 요약 (SubscriptionPaymentSummary).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "대상 센터의 UUID.",
            },
            "payment_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 결제",
                "description": "취소할 결제의 UUID.",
            },
            "reason": {
                "type": "string",
                "title": "취소 사유",
                "description": "결제 취소 사유.",
            },
        },
        "required": ["center_id", "payment_id", "reason"],
    },
}
