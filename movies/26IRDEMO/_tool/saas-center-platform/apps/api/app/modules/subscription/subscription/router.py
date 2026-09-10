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

from fastapi import APIRouter, Depends, Query

from app.behavior import (
    behavior,
    ServerContext,
    UnscopedContext,
    authenticate,
    require_membership,
    start_event_group,
    dispatch_events,
)
from app.core.config import settings

from app.application.handlers.subscription import (
    confirm_upgrade_handler,
)
from .handlers import (
    get_subscription_handler,
    get_plans_handler,
    initiate_upgrade_handler,
    reserve_downgrade_handler,
    cancel_downgrade_handler,
    list_subscription_payments_handler,
    request_plan_change_handler,
)
from .schemas import (
    SubscriptionResponse,
    PlanInfo,
    InitiateUpgradeRequest,
    InitiateUpgradeResponse,
    ConfirmUpgradeRequest,
    ReserveDowngradeRequest,
    SubscriptionPaymentSummary,
    TossClientKeyResponse,
    RequestPlanChangeRequest,
)

center_router = APIRouter(
    prefix="/centers/{center_id}/subscription",
    tags=["Subscription"],
)


@center_router.get("", response_model=SubscriptionResponse)
async def get_subscription(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await get_subscription_handler(ctx.center_id, ctx.uow)


@center_router.get("/plans", response_model=list[PlanInfo])
async def get_plans(
    # 공개 확정(2026-07-07) — 요금제 목록은 가입 전 화면용 공개 데이터(민감정보 없음)
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(),
    ),
):
    return await get_plans_handler(ctx.uow)


@center_router.post("/upgrade/initiate", response_model=InitiateUpgradeResponse)
async def initiate_upgrade(
    data: InitiateUpgradeRequest,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await initiate_upgrade_handler(
        center_id=ctx.center_id,
        target_plan=data.plan,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@center_router.post("/upgrade/confirm", response_model=SubscriptionResponse)
async def confirm_upgrade(
    data: ConfirmUpgradeRequest,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await confirm_upgrade_handler(
        center_id=ctx.center_id,
        payment_key=data.payment_key,
        order_id=data.order_id,
        amount=data.amount,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@center_router.post("/downgrade/reserve", response_model=SubscriptionResponse)
async def reserve_downgrade(
    data: ReserveDowngradeRequest,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await reserve_downgrade_handler(
        center_id=ctx.center_id,
        target_plan=data.plan,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@center_router.post("/downgrade/cancel", response_model=SubscriptionResponse)
async def cancel_downgrade(
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await cancel_downgrade_handler(
        center_id=ctx.center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@center_router.get("/payments", response_model=list[SubscriptionPaymentSummary])
async def list_payments(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
    limit: int = Query(20, ge=1, le=100, description="조회 건수"),
):
    return await list_subscription_payments_handler(
        center_id=ctx.center_id,
        limit=limit,
        uow=ctx.uow,
    )


@center_router.post("/request-plan-change", response_model=SubscriptionResponse)
async def request_plan_change(
    data: RequestPlanChangeRequest,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await request_plan_change_handler(
        center_id=ctx.center_id,
        target_plan=data.plan,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@center_router.get("/toss-client-key", response_model=TossClientKeyResponse)
async def get_toss_client_key(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return TossClientKeyResponse(client_key=settings.TOSS_CLIENT_KEY)


