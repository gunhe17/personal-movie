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
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from app.modules.platform_admin.admin_account.models import AdminRole

from app.application.handlers.subscription import (
    transition_status_handler,
    admin_reserve_downgrade_handler,
    admin_cancel_downgrade_handler,
    admin_cancel_payment_handler,
    reject_plan_change_handler,
    get_subscription_detail_handler,
    upgrade_plan_handler,
    adjust_credit_handler,
    approve_plan_change_handler,
    change_plan_handler,
    admin_force_apply_downgrade_handler,
    get_usage_overview_handler,
    admin_grant_trial_handler,
)
from .handlers import (
    get_subscription_stats_handler,
    admin_list_payments_handler,
    aggregate_admin_payment_stats_handler,
    get_mrr_trend_handler,
)
from .schemas import (
    SubscriptionResponse,
    UpgradePlanRequest,
    ChangePlanRequest,
    GrantTrialRequest,
    AdjustCreditRequest,
    AdminSubscriptionDetailResponse,
    CreditSummary,
    SubscriptionStatsResponse,
    SubscriptionUsageOverviewResponse,
    ReserveDowngradeRequest,
    TransitionStatusRequest,
    SubscriptionPaymentSummary,
    PaymentListResponse,
    PaymentStatsResponse,
    CancelPaymentRequest,
    MrrTrendResponse,
    RejectPlanChangeRequest,
)

admin_router = APIRouter(
    prefix="/admin/subscriptions",
    tags=["Admin - Subscription"],
)


@admin_router.get("/stats", response_model=SubscriptionStatsResponse)
async def get_stats(
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await get_subscription_stats_handler(uow=ctx.uow)


@admin_router.get("/usage-overview", response_model=SubscriptionUsageOverviewResponse)
async def get_usage_overview(
    year: int | None = Query(None, description="조회 연도 (미지정 시 올해)"),
    month: int | None = Query(None, description="조회 월 (미지정 시 이번 달)"),
    top_limit: int = Query(10, ge=0, description="크레딧 TOP 센터 수 (0이면 전체)"),
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await get_usage_overview_handler(
        year=year,
        month=month,
        top_limit=top_limit,
        uow=ctx.uow,
    )


@admin_router.get("/payment-stats", response_model=PaymentStatsResponse)
async def admin_payment_stats(
    year: int | None = Query(None, description="조회 연도 (미지정 시 올해)"),
    month: int | None = Query(None, description="조회 월 (미지정 시 이번 달)"),
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    from app.core.datetime_utils import utc_now

    now = utc_now()
    return await aggregate_admin_payment_stats_handler(
        year=year or now.year,
        month=month or now.month,
        uow=ctx.uow,
    )


@admin_router.get("/mrr-trend", response_model=MrrTrendResponse)
async def get_mrr_trend(
    months: int = Query(6, ge=3, le=12, description="조회 월수"),
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await get_mrr_trend_handler(months=months, uow=ctx.uow)


@admin_router.get("/{center_id}", response_model=AdminSubscriptionDetailResponse)
async def get_subscription_detail(
    center_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await get_subscription_detail_handler(
        center_id=center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
    )


@admin_router.post("/{center_id}/upgrade", response_model=SubscriptionResponse)
async def upgrade_plan(
    center_id: str,
    data: UpgradePlanRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await upgrade_plan_handler(
        center_id=center_id,
        new_plan=data.plan,
        actor_type="admin",
        reason=data.reason,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@admin_router.post("/{center_id}/change-plan", response_model=SubscriptionResponse)
async def change_plan(
    center_id: str,
    data: ChangePlanRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await change_plan_handler(
        center_id=center_id,
        new_plan=data.plan,
        actor_type="admin",
        reason=data.reason,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@admin_router.post("/{center_id}/grant-trial", response_model=SubscriptionResponse)
async def admin_grant_trial(
    center_id: str,
    data: GrantTrialRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await admin_grant_trial_handler(
        center_id=center_id,
        reason=data.reason,
        duration_days=data.duration_days,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@admin_router.post(
    "/{center_id}/transition-status", response_model=SubscriptionResponse
)
async def transition_status(
    center_id: str,
    data: TransitionStatusRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await transition_status_handler(
        center_id=center_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@admin_router.post("/{center_id}/adjust-credit", response_model=CreditSummary)
async def adjust_credit(
    center_id: str,
    data: AdjustCreditRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await adjust_credit_handler(
        center_id=center_id,
        adjust_type=data.adjust_type,
        amount=data.amount,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@admin_router.post(
    "/{center_id}/reserve-downgrade", response_model=SubscriptionResponse
)
async def admin_reserve_downgrade(
    center_id: str,
    data: ReserveDowngradeRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await admin_reserve_downgrade_handler(
        center_id=center_id,
        target_plan=data.plan,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@admin_router.delete(
    "/{center_id}/scheduled-downgrade", response_model=SubscriptionResponse
)
async def admin_cancel_downgrade(
    center_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await admin_cancel_downgrade_handler(
        center_id=center_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@admin_router.post(
    "/{center_id}/force-apply-downgrade", response_model=SubscriptionResponse
)
async def admin_force_apply_downgrade(
    center_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await admin_force_apply_downgrade_handler(
        center_id=center_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@admin_router.get("/{center_id}/payments", response_model=PaymentListResponse)
async def admin_list_payments(
    center_id: str,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await admin_list_payments_handler(
        center_id,
        page=page,
        size=size,
        uow=ctx.uow,
    )


@admin_router.post("/{center_id}/approve", response_model=SubscriptionResponse)
async def approve_plan_change(
    center_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await approve_plan_change_handler(
        center_id=center_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@admin_router.post("/{center_id}/reject", response_model=SubscriptionResponse)
async def reject_plan_change(
    center_id: str,
    data: RejectPlanChangeRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await reject_plan_change_handler(
        center_id=center_id,
        reason=data.reason,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@admin_router.post(
    "/{center_id}/cancel-payment", response_model=SubscriptionPaymentSummary
)
async def admin_cancel_payment(
    center_id: str,
    data: CancelPaymentRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await admin_cancel_payment_handler(
        center_id=center_id,
        payment_id=data.payment_id,
        reason=data.reason,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


