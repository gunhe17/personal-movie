from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.plan_config import get_plan_config
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def approve_plan_change_handler(
    *,
    center_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> SubscriptionResponse:
    sub_facade = SubscriptionFacade(uow)
    subscription_atomic, response = await sub_facade.approve_plan_change_with_response(
        center_id
    )

    new_config = get_plan_config(response.plan)

    # 크레딧 연동 (유료 플랜일 때만 — free는 크레딧 미제공)
    quota_atomic = None
    used_atomic = None
    credit_atomic = None
    rollover_atomics = []
    if new_config.credit_limit > 0:
        credit_facade = CreditFacade(uow)

        rollover_atomics, old_balance = await credit_facade.find_balance(center_id)
        old_used = old_balance.credit_used if old_balance else 0

        credit_atomic, _ = await credit_facade.initialize_credit(
            center_id=center_id,
            plan_type=response.plan,
            period_start=response.current_period_start,
            period_end=response.current_period_end,
        )

        # 다운그레이드: 기존 사용량이 새 한도 초과 시 quota_exceeded 처리
        if old_used > new_config.credit_limit:
            used_atomic, _ = await credit_facade.set_credit_used(center_id, old_used)
            quota_atomic, _ = await sub_facade.start_quota_grace(center_id)

    await emit(
        uow,
        "subscription_plan_change_approved",
        event_group_id=event_group_id,
        atomics=[
            subscription_atomic,
            AdminAuditAtomic(
                _act="plan_change_approved",
                _entity_name="subscription",
                _entity_id=center_id,
                _payload={"data": {"new_plan": response.plan}},
            ),
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
    "name": "approve_plan_change_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "예약된 요금제 변경 요청을 승인해 적용한다.",
    "keywords": [
        "approve plan change",
        "요금제 변경 승인",
        "플랜 변경 승인",
        "구독 변경 승인",
        "plan change 승인",
    ],
    "boundaries": "운영자 전용 — '예약된' 요금제 변경을 승인. 즉시 변경은 change_plan_handler, 강제 다운그레이드는 admin_force_apply_downgrade_handler.",
    "output": "변경이 적용된 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "예약된 요금제 변경을 승인할 센터의 UUID.",
            },
        },
        "required": ["center_id"],
    },
}
