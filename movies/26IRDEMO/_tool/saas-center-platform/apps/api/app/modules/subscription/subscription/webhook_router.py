"""Subscription Router.

센터 사용자용:
  GET    /centers/{center_id}/subscription                   — 내 구독 조회
  GET    /centers/{center_id}/subscription/plans             — 플랜 목록
  POST   /centers/{center_id}/subscription/upgrade/initiate  — 업그레이드 결제 시작
  POST   /centers/{center_id}/subscription/upgrade/confirm   — 업그레이드 결제 확인
  POST   /centers/{center_id}/subscription/downgrade/reserve — 다운그레이드 예약
  DELETE /centers/{center_id}/subscription/downgrade/reserve — 다운그레이드 예약 취소
  GET    /centers/{center_id}/subscription/payments          — 결제 이력
  GET    /centers/{center_id}/subscription/toss-client-key   — 토스 클라이언트 키

플랫폼 관리자용 (SuperAdmin):
  POST /admin/subscriptions/{center_id}/upgrade     — 플랜 업그레이드
  POST /admin/subscriptions/{center_id}/change-plan — 플랜 변경

토스 웹훅:
  POST /webhooks/toss/payment — 결제 상태 변경 알림
"""

from fastapi import APIRouter, Depends

from app.behavior import (
    behavior,
    UnscopedContext,
    gate,
    start_event_group,
    dispatch_events,
)
from app.infrastructure.payment.toss.webhook import verify_toss_webhook

from app.application.handlers.subscription import (
    toss_webhook_handler,
)

webhook_router = APIRouter(
    prefix="/webhooks/toss",
    tags=["Webhook - Toss"],
)


@webhook_router.post("/payment")
async def toss_payment_webhook(
    payload: dict,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            gate(verify_toss_webhook),
            dispatch_events(),
        ),
    ),
):
    return await toss_webhook_handler(
        payload=payload,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
    )
