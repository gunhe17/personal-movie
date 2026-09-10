from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.plan_config import get_plan_config
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def admin_force_apply_downgrade_handler(
    *,
    center_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> SubscriptionResponse:
    sub_facade = SubscriptionFacade(uow)
    (
        subscription_atomic,
        response,
    ) = await sub_facade.force_apply_downgrade_with_response(center_id)

    credit_facade = CreditFacade(uow)
    new_config = get_plan_config(response.plan)
    rollover_atomics = []
    rollover_atomics, old_balance = await credit_facade.find_balance(center_id)
    old_used = old_balance.credit_used if old_balance else 0

    # Free 등 크레딧 미제공 플랜은 잔액을 만들지 않는다 — initialize_credit이 free를 raise하므로
    # 건너뛰고 남은 활성 잔액을 정리한다(paid 크레딧 잔존 방지).
    credit_atomic = None
    if new_config.credit_limit > 0:
        credit_atomic, _ = await credit_facade.initialize_credit(
            center_id=center_id,
            plan_type=response.plan,
            period_start=response.current_period_start,
            period_end=response.current_period_end,
        )
    else:
        clear_atomics, _ = await credit_facade.clear_credit(center_id)
        rollover_atomics.extend(clear_atomics)

    quota_atomic = None
    used_atomic = None
    if old_used > new_config.credit_limit and new_config.credit_limit > 0:
        used_atomic, _ = await credit_facade.set_credit_used(center_id, old_used)
        quota_atomic, _ = await sub_facade.start_quota_grace(center_id)

    await emit(
        uow,
        "subscription_downgrade_force_applied",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="downgrade_force_applied",
                _entity_name="subscription",
                _entity_id=center_id,
                _payload={"data": {"new_plan": response.plan}},
            ),
            subscription_atomic,
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
