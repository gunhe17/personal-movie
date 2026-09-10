from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import CreditSummary


async def adjust_credit_handler(
    *,
    center_id: str,
    adjust_type: str,
    amount: int,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> CreditSummary:
    credit_facade = CreditFacade(uow)
    balance_atomic, balance = await credit_facade.adjust_credit(
        center_id, adjust_type, amount
    )

    quota_atomic = None
    if balance.credit_used < balance.credit_limit:
        quota_atomic, _ = await SubscriptionFacade(uow).clear_quota_exceeded(center_id)

    await emit(
        uow,
        "subscription_credit_adjusted",
        event_group_id=event_group_id,
        atomics=[
            balance_atomic,
            AdminAuditAtomic(
                _act="credit_adjusted",
                _entity_name="subscription",
                _entity_id=center_id,
                _payload={"data": {"adjust_type": adjust_type, "amount": amount}},
            ),
            quota_atomic,
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return CreditSummary(
        credit_limit=balance.credit_limit,
        credit_used=balance.credit_used,
        credit_remaining=max(0, balance.credit_limit - balance.credit_used),
        period_start=balance.period_start,
        period_end=balance.period_end,
    )


TOOL = {
    "name": "adjust_credit_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영자가 센터의 AI 크레딧을 수동으로 증감 조정한다.",
    "keywords": [
        "adjust credit",
        "크레딧 조정",
        "크레딧 증감",
        "크레딧 충전",
        "크레딧 차감",
        "크레딧 수동 조정",
    ],
    "boundaries": "운영자 전용 — 센터 크레딧을 직접 가감한다. 구독 요금제 변경(change_plan/upgrade_plan)과 다르다.",
    "output": "조정 후 크레딧 요약 (CreditSummary).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "대상 센터의 UUID.",
            },
            "adjust_type": {
                "type": "string",
                "title": "조정 유형",
                "enum": ["add", "reset"],
                "description": "add=크레딧 충전(증가), reset=사용량 초기화.",
            },
            "amount": {
                "type": "integer",
                "title": "크레딧 양",
                "description": "조정할 크레딧 양(add일 때 더할 양).",
            },
        },
        "required": ["center_id", "adjust_type", "amount"],
    },
}
