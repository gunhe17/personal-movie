"""SUB-WEBHOOK 회귀: toss webhook DONE 처리는 결제금액을 검증해야 한다.
이전엔 동기 confirm 경로와 달리 금액 검증이 없어, 위변조된 금액으로도 plan 이 적용됐다.
금액 불일치면 payment 를 pending 그대로 두고 plan/credit 을 건드리지 않는다."""
from app.application.handlers.subscription.toss_webhook import toss_webhook_handler
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.subscription.plan_config import PaymentStatus
from app.modules.subscription.subscription_payment.repository import (
    SubscriptionPaymentRepository,
)


def _payload(order_id: str, total_amount: int) -> dict:
    return {
        "eventType": "PAYMENT_STATUS_CHANGED",
        "data": {
            "orderId": order_id,
            "status": "DONE",
            "paymentKey": "pk_test",
            "method": "카드",
            "totalAmount": total_amount,
        },
    }


async def test_amount_mismatch_holds_payment_pending(test_session):
    repo = SubscriptionPaymentRepository(test_session)
    payment = await repo.add_in_center(
        center_id="c1",
        subscription_id="sub-1",
        plan="pro",
        amount=10000,
        status=PaymentStatus.PENDING,
        toss_order_id="order-1",
    )
    await test_session.commit()

    uow = UnitOfWork(test_session)
    result = await toss_webhook_handler(_payload("order-1", 9999), uow=uow, event_group_id="eg-1")

    assert result == {"status": "amount_mismatch"}

    # payment 는 여전히 pending — 확인/플랜적용되지 않음
    reloaded = await repo.get_by_order_id(toss_order_id="order-1")
    assert reloaded.status == PaymentStatus.PENDING
