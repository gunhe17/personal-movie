from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def admin_grant_trial_handler(
    *,
    center_id: str,
    reason: str = "trial_granted",
    duration_days: int | None = None,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> SubscriptionResponse:
    sub_facade = SubscriptionFacade(uow)
    subscription_atomic, response = await sub_facade.grant_trial_with_response(
        center_id,
        actor_type="admin",
        reason=reason,
        duration_days=duration_days,
    )

    credit_facade = CreditFacade(uow)
    credit_atomic, _ = await credit_facade.initialize_credit(
        center_id=center_id,
        plan_type=response.plan,
        period_start=response.current_period_start,
        period_end=response.current_period_end,
    )

    await emit(
        uow,
        "subscription_trial_granted",
        event_group_id=event_group_id,
        atomics=[
            subscription_atomic,
            credit_atomic,
            AdminAuditAtomic(
                _act="trial_granted",
                _entity_name="subscription",
                _entity_id=center_id,
                _payload={"data": {"reason": reason, "duration_days": duration_days}},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return response
