from fastapi import APIRouter, Depends

from app.application.handlers.ai_lab.playground_run import playground_run_handler
from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from app.modules.platform_admin.admin_account.models import AdminRole
from ..experiment_run.schemas import ExperimentRunResponse, PlaygroundRunRequest

router = APIRouter(prefix="/internal/ai-lab/playground", tags=["AI Lab"])


@router.post("/run", response_model=ExperimentRunResponse)
async def playground_run(
    data: PlaygroundRunRequest,
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
    return await playground_run_handler(
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )
