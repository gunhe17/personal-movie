from fastapi import APIRouter, Depends, Query

from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
)
from app.modules.platform_admin.admin_account.models import AdminRole
from app.modules.subscription.subscription.schemas import (
    AdminSubscriptionListResponse,
    FailedPaymentListResponse,
)

from .handlers.admin_list_failed_payments import admin_list_failed_payments_handler
from .handlers.list_subscriptions import list_subscriptions_handler

router = APIRouter(tags=["Admin - Subscription"])


@router.get("", response_model=AdminSubscriptionListResponse)
async def list_subscriptions(
    plan: str | None = Query(None, description="플랜 필터"),
    status: str | None = Query(None, description="상태 필터"),
    search: str | None = Query(None, description="센터명 검색"),
    has_scheduled_downgrade: bool | None = Query(
        None, description="다운그레이드 예약 필터"
    ),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await list_subscriptions_handler(
        plan=plan,
        status=status,
        search=search,
        has_scheduled_downgrade=has_scheduled_downgrade,
        page=page,
        size=size,
        uow=ctx.uow,
    )


@router.get("/payment-failures", response_model=FailedPaymentListResponse)
async def admin_list_failed_payments(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await admin_list_failed_payments_handler(
        page=page,
        size=size,
        uow=ctx.uow,
    )
