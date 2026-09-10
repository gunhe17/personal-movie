"""subscription 돈 경로 characterization (U4/T1) — emit 배선 전후 도메인 동작 동일 green.

self-service(reserve/cancel/request downgrade·initiate upgrade)와 apply_plan_change의
DB 변이 + subscription_history 기록(actor_type/reason)을 고정한다. emit은 순수 추가라
이 불변식들이 배선 후에도 불변이어야 한다."""
from datetime import timedelta

from app.application.handlers.subscription.apply_expired_downgrades import (
    apply_expired_downgrades_handler,
)
from app.application.handlers.subscription.toss_webhook import toss_webhook_handler
from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.facade.subscription_facade import SubscriptionFacade
from app.modules.subscription.subscription.plan_config import (
    PlanType,
    PaymentStatus,
    SubscriptionStatus,
)
from app.modules.subscription.subscription.repository import SubscriptionRepository
from app.modules.subscription.subscription_history.repository import (
    SubscriptionHistoryRepository,
)


async def _seed_pro(session, center_id="c-sub-1"):
    repo = SubscriptionRepository(session)
    now = utc_now()
    sub = await repo.add_in_center(
        center_id=center_id,
        plan=PlanType.PRO,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    await session.commit()
    return sub


async def _latest_history(session, subscription_id):
    hist = await SubscriptionHistoryRepository(session).list_by_subscription(
        subscription_id=subscription_id, limit=1,
    )
    return hist[0]


async def test_reserve_downgrade_sets_reservation_and_history(test_session):
    sub = await _seed_pro(test_session)
    facade = SubscriptionFacade(UnitOfWork(test_session))

    _atomic, resp = await facade.reserve_downgrade_with_response("c-sub-1", PlanType.STARTER.value)
    await test_session.commit()

    assert resp.reserved_plan == "starter"
    assert resp.reserved_at is not None
    assert resp.plan == "pro"  # 현재 플랜은 유지(만료 시 적용)

    h = await _latest_history(test_session, sub.id)
    assert (h.to_plan, h.actor_type, h.reason) == ("starter", "user", "downgrade_reserved")


async def test_cancel_downgrade_clears_reservation_and_history(test_session):
    sub = await _seed_pro(test_session)
    facade = SubscriptionFacade(UnitOfWork(test_session))

    await facade.reserve_downgrade_with_response("c-sub-1", PlanType.STARTER.value)
    await test_session.commit()

    _atomic, resp = await facade.cancel_downgrade_with_response("c-sub-1")
    await test_session.commit()

    assert resp.reserved_plan is None
    assert resp.reserved_at is None

    h = await _latest_history(test_session, sub.id)
    assert (h.actor_type, h.reason) == ("user", "downgrade_cancelled")


async def test_request_plan_change_sets_pending_and_history(test_session):
    sub = await _seed_pro(test_session)
    facade = SubscriptionFacade(UnitOfWork(test_session))

    _atomic, resp = await facade.request_plan_change_with_response("c-sub-1", PlanType.STARTER.value)
    await test_session.commit()

    assert resp.reserved_plan == "starter"
    assert resp.status == "pending"

    h = await _latest_history(test_session, sub.id)
    assert (h.actor_type, h.reason) == ("user", "plan_change_requested")


async def test_apply_plan_change_system_actor(test_session):
    sub = await _seed_pro(test_session)
    facade = SubscriptionFacade(UnitOfWork(test_session))

    _atomic, updated = await facade.apply_plan_change(
        "c-sub-1", PlanType.STARTER, actor_type="system", reason="scheduled_downgrade_applied",
    )
    await test_session.commit()

    assert updated.plan == "starter"
    assert updated.reserved_plan is None

    h = await _latest_history(test_session, sub.id)
    assert (h.to_plan, h.actor_type, h.reason) == (
        "starter", "system", "scheduled_downgrade_applied",
    )


async def test_initiate_upgrade_creates_pending_payment(test_session):
    # 결제가 필요한 건 유료 플랜 업그레이드뿐 — free → pro
    repo = SubscriptionRepository(test_session)
    now = utc_now()
    await repo.add_in_center(
        center_id="c-sub-2",
        plan=PlanType.FREE,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    await test_session.commit()
    facade = SubscriptionFacade(UnitOfWork(test_session))

    _atomic, resp = await facade.initiate_upgrade("c-sub-2", PlanType.PRO.value)
    await test_session.commit()

    assert resp.order_id
    assert resp.plan == "pro"

    payment = await facade.find_payment_by_order_id(resp.order_id)
    assert payment is not None
    assert payment.status == PaymentStatus.PENDING


async def test_confirm_upgrade_confirms_payment_applies_plan_history_user(test_session):
    # free → pro 결제 개시 후 확정 = 결제 CONFIRMED + 플랜 적용 + 이력(user, payment_upgrade)
    repo = SubscriptionRepository(test_session)
    now = utc_now()
    sub = await repo.add_in_center(
        center_id="c-sub-3",
        plan=PlanType.FREE,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    await test_session.commit()
    facade = SubscriptionFacade(UnitOfWork(test_session))

    _atomic, init = await facade.initiate_upgrade("c-sub-3", PlanType.PRO.value)
    await test_session.commit()

    await facade.confirm_upgrade_by_plan(
        "c-sub-3",
        payment_key="pk-1",
        order_id=init.order_id,
        amount=init.amount,
        toss_response={"method": "카드"},
    )
    await test_session.commit()

    payment = await facade.find_payment_by_order_id(init.order_id)
    assert payment.status == PaymentStatus.CONFIRMED
    assert payment.toss_payment_key == "pk-1"

    updated = await facade.get_subscription("c-sub-3")
    assert updated.plan == "pro"

    h = await _latest_history(test_session, sub.id)
    assert (h.to_plan, h.actor_type, h.reason) == ("pro", "user", "payment_upgrade")


async def test_webhook_done_confirms_payment_and_applies_plan(test_session):
    # free → pro 결제 개시 후 웹훅 DONE = 결제 CONFIRMED + 플랜 적용(machine, 멱등)
    repo = SubscriptionRepository(test_session)
    now = utc_now()
    await repo.add_in_center(
        center_id="c-sub-wh",
        plan=PlanType.FREE,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    await test_session.commit()
    facade = SubscriptionFacade(UnitOfWork(test_session))

    _atomic, init = await facade.initiate_upgrade("c-sub-wh", PlanType.PRO.value)
    await test_session.commit()

    payload = {
        "eventType": "PAYMENT_STATUS_CHANGED",
        "data": {
            "orderId": init.order_id,
            "status": "DONE",
            "totalAmount": init.amount,
            "paymentKey": "pk-wh",
        },
    }
    result = await toss_webhook_handler(
        payload, uow=UnitOfWork(test_session), event_group_id="eg-wh",
    )
    await test_session.commit()

    assert result == {"status": "ok"}
    payment = await facade.find_payment_by_order_id(init.order_id)
    assert payment.status == PaymentStatus.CONFIRMED
    updated = await facade.get_subscription("c-sub-wh")
    assert updated.plan == "pro"


async def test_process_expirations_applies_reserved_downgrade(test_session):
    # 만료 + 예약 다운그레이드 = 크론이 예약 플랜으로 적용(machine)
    repo = SubscriptionRepository(test_session)
    now = utc_now()
    sub = await repo.add_in_center(
        center_id="c-sub-exp",
        plan=PlanType.PRO,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=now - timedelta(days=60),
        current_period_end=now - timedelta(days=1),
    )
    await repo.update_in_center(
        subscription_id=sub.id,
        center_id="c-sub-exp",
        reserved_plan=PlanType.STARTER.value,
        reserved_at=now - timedelta(days=30),
    )
    await test_session.commit()

    result = await apply_expired_downgrades_handler(
        UnitOfWork(test_session), event_group_id="eg-exp",
    )
    await test_session.commit()

    assert result["processed"] >= 1
    facade = SubscriptionFacade(UnitOfWork(test_session))
    updated = await facade.get_subscription("c-sub-exp")
    assert updated.plan == "starter"
    assert updated.reserved_plan is None
