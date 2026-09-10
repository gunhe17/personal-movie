# 토스 PAYMENT_STATUS_CHANGED 이벤트 처리:
# - DONE (pending → confirmed): 결제 완료 + 플랜 즉시 적용 (클라이언트 confirm 누락 대비)
# - CANCELED (confirmed → cancelled): 결제 취소 반영
# - ABORTED (pending → failed): 결제 실패 반영
from app.core.logger import get_logger
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.plan_config import PaymentStatus, PlanType

logger = get_logger(__name__)


async def toss_webhook_handler(
    payload: dict,
    *,
    uow: UnitOfWork,
    event_group_id: uuid_str,
) -> dict:
    event_type = payload.get("eventType", "")
    data = payload.get("data", {})

    if event_type not in ("PAYMENT_STATUS_CHANGED",):
        logger.info("토스 웹훅 무시: eventType=%s", event_type)
        return {"status": "ignored"}

    order_id = data.get("orderId")
    status = data.get("status", "").upper()

    if not order_id:
        logger.warning("토스 웹훅: orderId 누락")
        return {"status": "ignored"}

    sub_facade = SubscriptionFacade(uow)
    payment = await sub_facade.find_payment_by_order_id(order_id)

    if not payment:
        logger.warning("토스 웹훅: 결제 미발견 order_id=%s", order_id)
        return {"status": "not_found"}

    if status == "DONE" and payment.status == PaymentStatus.PENDING:
        from app.core.datetime_utils import utc_now

        # 위변조 검증: 토스가 보고한 실제 결제금액이 우리 payment 금액과 일치해야 한다
        # (동기 confirm 경로와 동일 가드). totalAmount 미제공 시 검증 불가 → 경고만 남기고 진행.
        charged = data.get("totalAmount")
        charged_int = (
            int(charged)
            if isinstance(charged, (int, str)) and str(charged).lstrip("-").isdigit()
            else None
        )
        if charged_int is not None and charged_int != payment.amount:
            logger.warning(
                "토스 웹훅: 결제금액 불일치 order_id=%s 예상=%s 실제=%s — 확인/플랜적용 보류",
                order_id,
                payment.amount,
                charged_int,
            )
            return {"status": "amount_mismatch"}

        pay_atomic, _ = await sub_facade.update_payment(
            payment.id,
            act="confirmed",
            status=PaymentStatus.CONFIRMED,
            toss_payment_key=data.get("paymentKey"),
            method=data.get("method", ""),
            paid_at=utc_now(),
            raw_response=str(data),
        )
        atomics = [pay_atomic]

        # 멱등성: 플랜이 이미 적용됐으면 스킵.
        sub = await sub_facade.find_active(payment.center_id)
        if sub and sub.plan != payment.plan:
            sub_atomic, updated = await sub_facade.apply_plan_change(
                payment.center_id,
                PlanType(payment.plan),
                actor_type="system",
                reason="webhook_payment_confirmed",
                validate_upgrade=False,
            )
            atomics.append(sub_atomic)

            credit_facade = CreditFacade(uow)
            credit_atomic, _ = await credit_facade.initialize_credit(
                center_id=payment.center_id,
                plan_type=updated.plan,
                period_start=updated.current_period_start,
                period_end=updated.current_period_end,
            )
            atomics.append(credit_atomic)

            logger.info(
                "토스 웹훅: 결제 완료 + 플랜 적용 order_id=%s, plan=%s",
                order_id,
                payment.plan,
            )
        else:
            logger.info(
                "토스 웹훅: 결제 확인 (플랜 이미 적용됨) order_id=%s",
                order_id,
            )

        # 웹훅(기계) — 결제 확정 + (있으면) 플랜 적용 사실
        await emit(
            uow,
            "subscription_payment_confirmed",
            event_group_id=event_group_id,
            atomics=atomics,
            center_id=payment.center_id,
            actor_type="machine",
        )

    elif status == "CANCELED" and payment.status == PaymentStatus.CONFIRMED:
        pay_atomic, _ = await sub_facade.update_payment(
            payment.id,
            act="cancelled",
            status=PaymentStatus.CANCELLED,
        )
        await emit(
            uow,
            "subscription_payment_cancelled",
            event_group_id=event_group_id,
            atomics=[pay_atomic],
            center_id=payment.center_id,
            actor_type="machine",
        )
        logger.info("토스 웹훅: 결제 취소 반영 order_id=%s", order_id)

    elif status == "ABORTED" and payment.status == PaymentStatus.PENDING:
        pay_atomic, _ = await sub_facade.update_payment(
            payment.id,
            act="failed",
            status=PaymentStatus.FAILED,
            failed_reason=data.get("failure", {}).get("message", ""),
        )
        await emit(
            uow,
            "subscription_payment_failed",
            event_group_id=event_group_id,
            atomics=[pay_atomic],
            center_id=payment.center_id,
            actor_type="machine",
        )
        logger.info("토스 웹훅: 결제 실패 반영 order_id=%s", order_id)

    return {"status": "ok"}
