from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    require_feature,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Body, Depends

from app.core.permissions import Permission
from app.core.schemas import StatusMessageResponse
from .schemas import (
    CaseAnalysisPreviewResponse,
    CaseAnalysisResponse,
    CaseAnalysisTrigger,
)

router = APIRouter(
    prefix="/centers/{center_id}/counseling/cases/{case_id}/analysis",
    tags=["Counseling - Case Analysis"],
    dependencies=[
        Depends(
            behavior.request(
                authenticate(),
                require_membership(),
                require_feature("ai_case_analysis"),
            )
        )
    ],
)


@router.get(
    "/preview",
    response_model=CaseAnalysisPreviewResponse,
)
async def preview_analysis(
    case_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    from .handlers import preview_case_analysis_handler

    return await preview_case_analysis_handler(case_id, ctx.center_id, ctx.uow)


@router.post(
    "/",
    status_code=202,
    response_model=StatusMessageResponse,
)
async def create_analysis(
    case_id: str,
    data: CaseAnalysisTrigger = Body(default_factory=CaseAnalysisTrigger),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING),
            dispatch_events(),
        )
    ),
):
    from .handlers import create_case_analysis_handler

    return await create_case_analysis_handler(
        event_group_id=ctx.event_group_id,
        case_id=case_id,
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        account_id=ctx.account_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
        session_take=data.session_take,
    )


@router.get(
    "/latest",
    response_model=CaseAnalysisResponse | None,
)
async def get_latest_analysis(
    case_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    from .handlers import get_latest_case_analysis_handler

    return await get_latest_case_analysis_handler(case_id, ctx.center_id, ctx.uow)


@router.get(
    "/",
    response_model=list[CaseAnalysisResponse],
)
async def list_analyses(
    case_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    from .handlers import list_case_analyses_handler

    return await list_case_analyses_handler(case_id, ctx.center_id, ctx.uow)
