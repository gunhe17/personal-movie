from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.plan_config import get_plan_config
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def change_plan_handler(
    *,
    center_id: str,
    new_plan: str,
    actor_type: str = "admin",
    reason: str = "plan_change",
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> SubscriptionResponse:
    sub_facade = SubscriptionFacade(uow)
    credit_facade = CreditFacade(uow)

    subscription_atomic, response = await sub_facade.change_plan_with_response(
        center_id,
        new_plan,
        actor_type=actor_type,
        reason=reason,
    )

    new_config = get_plan_config(new_plan)

    quota_atomic = None
    used_atomic = None
    credit_atomic = None
    clear_atomics: list = []
    rollover_atomics = []
    if new_config.credit_limit == 0:
        # Free 플랜: 크레딧 불필요 → 레코드 soft delete + 쿼터 초과 해제
        clear_atomics, _ = await credit_facade.clear_credit(center_id)
        quota_atomic, _ = await sub_facade.clear_quota_exceeded(center_id)
    else:
        rollover_atomics, old_balance = await credit_facade.find_balance(center_id)
        old_used = old_balance.credit_used if old_balance else 0

        credit_atomic, _ = await credit_facade.initialize_credit(
            center_id=center_id,
            plan_type=new_plan,
            period_start=response.current_period_start,
            period_end=response.current_period_end,
        )

        # 다운그레이드: 기존 사용량이 새 한도 초과 시 quota_exceeded 처리
        if old_used > new_config.credit_limit:
            used_atomic, _ = await credit_facade.set_credit_used(center_id, old_used)
            quota_atomic, _ = await sub_facade.start_quota_grace(center_id)
            response.is_quota_exceeded = True

    await emit(
        uow,
        "subscription_plan_changed",
        event_group_id=event_group_id,
        atomics=[
            subscription_atomic,
            AdminAuditAtomic(
                _act="plan_changed",
                _entity_name="subscription",
                _entity_id=center_id,
                _payload={"data": {"new_plan": new_plan, "reason": reason}},
            ),
            *clear_atomics,
            *rollover_atomics,
            credit_atomic,
            used_atomic,
            quota_atomic,
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return response


TOOL = {
    "name": "change_plan_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "센터의 구독 요금제를 변경한다.",
    "keywords": [
        "change plan",
        "요금제 변경",
        "플랜 변경",
        "구독 변경",
        "plan 변경",
        "요금제 전환",
    ],
    "boundaries": "요금제를 '변경'한다(업/다운 모두). 업그레이드 전용 흐름은 upgrade_plan_handler, 변경 승인은 approve_plan_change_handler.",
    "output": "변경된 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "요금제를 변경할 센터의 UUID.",
            },
            "new_plan": {
                "type": "string",
                "title": "새 요금제",
                "enum": ["free", "starter", "pro", "enterprise"],
                "description": "변경할 요금제 코드.",
            },
            "reason": {
                "type": "string",
                "title": "변경 사유",
                "description": "변경 사유(선택).",
            },
        },
        "required": ["center_id", "new_plan"],
    },
}
