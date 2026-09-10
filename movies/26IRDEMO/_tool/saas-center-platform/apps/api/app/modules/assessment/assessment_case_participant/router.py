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
    list_assessment_participants_handler,
    add_assessment_participant_handler,
    remove_assessment_participant_handler,
)
from .schemas import ParticipantAdd, ParticipantResponse

router = APIRouter(prefix="/centers/{center_id}/assessment-cases/{case_id}/participants", tags=["AssessmentCase"])


@router.get(
    "",
    response_model=list[ParticipantResponse],
)
async def list_participants(
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
    return await list_assessment_participants_handler(ctx.center_id, case_id, ctx.uow)


@router.post(
    "",
    response_model=ParticipantResponse,
    status_code=201,
)
async def add_participant(
    case_id: str,
    data: ParticipantAdd,
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
    return await add_assessment_participant_handler(
        ctx.center_id,
        case_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.delete(
    "/{participant_type}/{participant_id}",
    response_model=ParticipantResponse,
)
async def remove_participant(
    case_id: str,
    participant_type: str,
    participant_id: str,
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
    return await remove_assessment_participant_handler(
        ctx.center_id,
        case_id,
        participant_type,
        participant_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )
