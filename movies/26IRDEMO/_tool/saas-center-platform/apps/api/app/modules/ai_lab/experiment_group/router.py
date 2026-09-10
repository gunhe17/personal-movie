from fastapi import APIRouter, Depends, Query

from app.application.handlers.ai_lab.run_batch_compare import run_batch_compare_handler
from app.behavior import behavior, AdminContext, UnscopedContext, authenticate_admin, require_role, start_event_group, dispatch_events
from app.core.schemas import OkResponse
from app.modules.platform_admin.admin_account.models import AdminRole
from .handlers import (
    list_experiment_groups_handler,
    get_experiment_group_handler,
    get_experiment_comparison_handler,
    delete_experiment_group_handler,
)
from .schemas import (
    ExperimentGroupResponse,
    ExperimentGroupListResponse,
    BatchCompareRequest,
    ComparisonResultResponse,
)

router = APIRouter(prefix="/internal/ai-lab/experiment-groups", tags=["AI Lab - Experiment Groups"])


@router.post(
    "/compare",
    response_model=ExperimentGroupResponse,
)
async def run_batch_compare(
    data: BatchCompareRequest,
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
    return await run_batch_compare_handler(
        event_group_id=ctx.event_group_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.admin_account_id,
    )


@router.get("", response_model=ExperimentGroupListResponse)
async def list_experiment_groups(
    experiment_type: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await list_experiment_groups_handler(
        experiment_type, status, page, size, ctx.uow
    )


@router.get("/{group_id}", response_model=ExperimentGroupResponse)
async def get_experiment_group(
    group_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await get_experiment_group_handler(group_id, ctx.uow)


@router.get("/{group_id}/comparison", response_model=ComparisonResultResponse)
async def get_experiment_comparison(
    group_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await get_experiment_comparison_handler(group_id, ctx.uow)


@router.delete("/{group_id}", response_model=OkResponse)
async def delete_experiment_group(
    group_id: str,
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
    return await delete_experiment_group_handler(
        group_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )
