from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends

from app.core.permissions import Permission
from .handlers import (
    list_assessment_sessions_handler,
    get_assessment_session_handler,
    create_assessment_session_handler,
    update_assessment_session_handler,
    attend_assessment_session_handler,
    no_show_assessment_session_handler,
    cancel_assessment_session_handler,
    revert_cancel_assessment_session_handler,
)
from .schemas import (
    AssessmentSessionCreate,
    AssessmentSessionUpdate,
    AssessmentSessionResponse,
    CancelSessionRequest,
)

router = APIRouter(prefix="/centers/{center_id}", tags=["AssessmentSession"])


@router.get(
    "/assessment-cases/{case_id}/assessment-sessions",
    response_model=list[AssessmentSessionResponse],
)
async def list_sessions(
    case_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
        )
    ),
):
    return await list_assessment_sessions_handler(ctx.center_id, case_id, ctx.uow)


@router.get(
    "/assessment-sessions/{session_id}",
    response_model=AssessmentSessionResponse,
)
async def get_session(
    session_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
        )
    ),
):
    return await get_assessment_session_handler(ctx.center_id, session_id, ctx.uow)


@router.post(
    "/assessment-cases/{case_id}/assessment-sessions",
    response_model=AssessmentSessionResponse,
    status_code=201,
)
async def create_session(
    case_id: str,
    data: AssessmentSessionCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await create_assessment_session_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        case_id=case_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.patch(
    "/assessment-sessions/{session_id}",
    response_model=AssessmentSessionResponse,
)
async def update_session(
    session_id: str,
    data: AssessmentSessionUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await update_assessment_session_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        session_id=session_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/assessment-sessions/{session_id}/attend",
    response_model=AssessmentSessionResponse,
)
async def attend_session(
    session_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await attend_assessment_session_handler(
        center_id=ctx.center_id,
        session_id=session_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/assessment-sessions/{session_id}/no-show",
    response_model=AssessmentSessionResponse,
)
async def no_show_session(
    session_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await no_show_assessment_session_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        session_id=session_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/assessment-sessions/{session_id}/cancel",
    response_model=AssessmentSessionResponse,
)
async def cancel_session(
    session_id: str,
    data: CancelSessionRequest = CancelSessionRequest(),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await cancel_assessment_session_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        session_id=session_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
        cancel_reason=data.cancel_reason,
    )


@router.post(
    "/assessment-sessions/{session_id}/revert-cancel",
    response_model=AssessmentSessionResponse,
)
async def revert_cancel_session(
    session_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_SCHEDULE),
            dispatch_events(),
        )
    ),
):
    return await revert_cancel_assessment_session_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        session_id=session_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )
