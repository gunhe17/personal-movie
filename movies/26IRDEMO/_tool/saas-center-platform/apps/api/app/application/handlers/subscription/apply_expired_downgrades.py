from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.plan_config import PlanType, get_plan_config


async def apply_expired_downgrades_handler(
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
) -> dict:
    sub_facade = SubscriptionFacade(uow)
    credit_facade = CreditFacade(uow)

    expired = await sub_facade.list_expired_with_reservation()

    atomics = []
    processed = 0
    for sub in expired:
        # reserved_plan을 미리 잡아둔다 — apply_plan_change가 같은 세션 객체의
        # reserved_plan을 None으로 지워 이후 참조가 깨지기 때문(실버그 정정).
        target_plan = sub.reserved_plan
        center_id = sub.center_id

        atomic, updated = await sub_facade.apply_plan_change(
            center_id,
            PlanType(target_plan),
            actor_type="system",
            reason="scheduled_downgrade_applied",
        )
        atomics.append(atomic)

        new_config = get_plan_config(target_plan)
        rollover_atomics, old_balance = await credit_facade.find_balance(center_id)
        atomics.extend(rollover_atomics)
        old_used = old_balance.credit_used if old_balance else 0

        # 크레딧 주기는 적용 후 새 기간에 정렬(apply_plan_change가 기간 리셋).
        # Free 등 크레딧 미제공 플랜(credit_limit=0)은 잔액을 만들지 않는다 — initialize_credit이
        # free를 raise해 이 크론 배치 전체가 크래시하므로, 건너뛰고 남은 활성 잔액을 정리한다.
        if new_config.credit_limit > 0:
            credit_atomic, _ = await credit_facade.initialize_credit(
                center_id=center_id,
                plan_type=target_plan,
                period_start=updated.current_period_start,
                period_end=updated.current_period_end,
            )
            atomics.append(credit_atomic)
        else:
            clear_atomics, _ = await credit_facade.clear_credit(center_id)
            atomics.extend(clear_atomics)

        if old_used > new_config.credit_limit and new_config.credit_limit > 0:
            used_atomic, _ = await credit_facade.set_credit_used(center_id, old_used)
            atomics.append(used_atomic)
            grace_atomic, _ = await sub_facade.start_quota_grace(center_id)
            atomics.append(grace_atomic)

        processed += 1

    # 크론(기계) = 예약 다운그레이드 일괄 적용. actor 없음(actor_type=machine).
    await emit(
        uow,
        "subscription_downgrade_applied",
        event_group_id=event_group_id,
        atomics=atomics,
        actor_type="machine",
    )

    return {"processed": processed}
