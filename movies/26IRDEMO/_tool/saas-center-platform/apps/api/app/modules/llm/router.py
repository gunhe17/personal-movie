from fastapi import APIRouter, Depends, HTTPException, status

from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    start_event_group,
    dispatch_events,
)
from .handlers import (
    get_credit_balance_handler,
    get_credit_rate_config_handler,
    get_credit_usage_handler,
    initialize_credit_handler,
)
from app.application.handlers.llm.get_credit_history import get_credit_history_handler
from .schemas import (
    CreditBalanceResponse,
    CreditHistoryResponse,
    CreditInitRequest,
    CreditRateConfigResponse,
    CreditUsageResponse,
)
from app.modules.role.role.schemas import RoleCode

router = APIRouter(prefix="/centers/{center_id}/credit", tags=["Credit"])

# 관리자 역할 (initialize_credit 접근 제한용)
_ADMIN_ROLES = {RoleCode.ADMIN.value, RoleCode.MANAGER.value}


@router.get(
    "",
    response_model=CreditBalanceResponse | None,
)
async def get_credit_balance(
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await get_credit_balance_handler(
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.post(
    "",
    response_model=CreditBalanceResponse,
)
async def initialize_credit(
    data: CreditInitRequest,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    if ctx.role_code not in _ADMIN_ROLES and "*" not in ctx.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="크레딧 초기화는 관리자만 수행할 수 있습니다.",
        )

    return await initialize_credit_handler(
        center_id=ctx.center_id,
        plan_type=data.plan_type,
        period_start=data.period_start,
        period_end=data.period_end,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/usage",
    response_model=CreditUsageResponse,
)
async def get_credit_usage(
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await get_credit_usage_handler(
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/rate-config",
    response_model=CreditRateConfigResponse | None,
)
async def get_credit_rate_config(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await get_credit_rate_config_handler(ctx.uow)


# 비율 변경(전역 config)은 platform-admin 전용 — /admin/ai-usage/rate-config 에서만.
# center-scoped 변경 라우트는 전역 설정을 center 역할로 바꾸는 권한상승이라 제거(2026-06-24).


@router.get(
    "/history",
    response_model=CreditHistoryResponse,
)
async def get_credit_history(
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await get_credit_history_handler(
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )
