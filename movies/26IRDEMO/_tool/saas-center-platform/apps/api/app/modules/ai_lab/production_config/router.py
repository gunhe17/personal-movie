from fastapi import APIRouter, Depends

from app.behavior import (
    behavior,
    AdminContext,
    UnscopedContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from app.modules.platform_admin.admin_account.models import AdminRole
from .handlers import (
    list_production_configs_handler,
)
from app.application.handlers.ai_lab.promote_to_production import (
    promote_to_production_handler,
)
from .schemas import ProductionAIConfigResponse, PromoteToProductionRequest

router = APIRouter(prefix="/internal/ai-lab/production-configs", tags=["AI Lab - Production Config"])


@router.get("", response_model=list[ProductionAIConfigResponse])
async def list_production_configs(
    module: str | None = None,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await list_production_configs_handler(module, ctx.uow)


@router.post("/promote", response_model=ProductionAIConfigResponse)
async def promote_to_production(
    data: PromoteToProductionRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await promote_to_production_handler(
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )
