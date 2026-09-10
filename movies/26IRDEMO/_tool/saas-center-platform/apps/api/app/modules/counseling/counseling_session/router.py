from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.core.permissions import Permission
from .schemas import (
    CounselingSessionCreate,
    CounselingSessionUpdate,
    CounselingSessionResponse,
    CounselingSessionListResponse,
    CancelSessionRequest,
    UnloggedSessionListResponse,
)
from app.infrastructure.persistence.new_repository import single_page
from .handlers import (
    create_counseling_session_handler,
    list_counseling_sessions_handler,
    get_counseling_session_handler,
    update_counseling_session_handler,
    cancel_counseling_session_handler,
    revert_cancel_counseling_session_handler,
    update_attendance_handler,
    add_participants_handler,
    remove_counseling_participant_handler,
    find_unlogged_sessions_handler,
)
from app.application.handlers.counseling import (
    delete_session_handler,
    list_session_participants_handler,
    list_unprocessed_counseling_sessions_handler,
)
from app.application.schemas import UnprocessedSessionListResponse
from ..counseling_session_participant.schemas import (
    SessionParticipantUpdate,
    SessionParticipantBatchCreate,
    SessionParticipantResponse,
)

from app.application.schemas import (
    AddSessionsRequest,
    AddSessionsResponse,
    BulkSessionUpdateRequest,
    BulkSessionUpdateResponse,
    BulkSessionValidateResponse,
)

router = APIRouter(
    prefix="/centers/{center_id}/counseling", tags=["Counseling - Sessions"]
)


# 단일 세그먼트 경로는 케이스 라우터의 /{case_id}가 먼저 삼킨다 — /sessions 하위로 둔다
@router.get(
    "/sessions/unprocessed",
    response_model=UnprocessedSessionListResponse,
)
async def list_unprocessed_sessions(
    size: int = Query(20, ge=1, le=100),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    return await list_unprocessed_counseling_sessions_handler(
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        size=size,
        uow=ctx.uow,
    )


@router.get(
    "/counselors/me/unlogged-sessions",
    response_model=UnloggedSessionListResponse,
    description="관리자(owner_scope=None)는 본 신호 대상이 아니므로 빈 응답을 반환합니다.",
)
async def find_unlogged_sessions(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    if not ctx.owner_scope:
        return UnloggedSessionListResponse(items=[], **single_page([]))
    return await find_unlogged_sessions_handler(
        center_id=ctx.center_id,
        counselor_id=ctx.owner_scope,
        uow=ctx.uow,
    )


@router.post(
    "/sessions",
    status_code=201,
    response_model=CounselingSessionResponse,
)
async def create_session(
    data: CounselingSessionCreate,
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
    return await create_counseling_session_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/cases/{case_id}/sessions",
    response_model=CounselingSessionListResponse,
)
async def list_sessions(
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
    return await list_counseling_sessions_handler(case_id, ctx.center_id, ctx.owner_scope, ctx.uow)


@router.get(
    "/sessions/{session_id}",
    response_model=CounselingSessionResponse,
)
async def get_session(
    session_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    return await get_counseling_session_handler(
        session_id, ctx.center_id, ctx.owner_scope, ctx.uow
    )


@router.patch(
    "/sessions/{session_id}",
    response_model=CounselingSessionResponse,
)
async def update_session(
    session_id: str,
    data: CounselingSessionUpdate,
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
    return await update_counseling_session_handler(
        event_group_id=ctx.event_group_id,
        session_id=session_id,
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/sessions/{session_id}",
    status_code=204,
)
async def delete_session(
    session_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_COUNSELING),
            dispatch_events(),
        )
    ),
):
    await delete_session_handler(
        event_group_id=ctx.event_group_id,
        session_id=session_id,
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/sessions/{session_id}/cancel",
    response_model=CounselingSessionResponse,
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
            require_permission(Permission.WRITE_COUNSELING),
            dispatch_events(),
        )
    ),
):
    return await cancel_counseling_session_handler(
        event_group_id=ctx.event_group_id,
        session_id=session_id,
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        cancel_reason=data.cancel_reason,
    )


@router.post(
    "/sessions/{session_id}/revert-cancel",
    response_model=CounselingSessionResponse,
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
    return await revert_cancel_counseling_session_handler(
        event_group_id=ctx.event_group_id,
        session_id=session_id,
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/sessions/{session_id}/participants",
    response_model=list[SessionParticipantResponse],
)
async def list_session_participants(
    session_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    return await list_session_participants_handler(
        session_id, ctx.center_id, ctx.owner_scope, ctx.uow
    )


@router.post(
    "/sessions/{session_id}/participants",
    status_code=201,
    response_model=list[SessionParticipantResponse],
)
async def add_participants(
    session_id: str,
    data: SessionParticipantBatchCreate,
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
    return await add_participants_handler(
        event_group_id=ctx.event_group_id,
        session_id=session_id,
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.patch(
    "/session-participants/{session_participant_id}",
    response_model=SessionParticipantResponse,
)
async def update_session_participant(
    session_participant_id: str,
    data: SessionParticipantUpdate,
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
    return await update_attendance_handler(
        event_group_id=ctx.event_group_id,
        session_participant_id=session_participant_id,
        center_id=ctx.center_id,
        member_id=ctx.owner_scope,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/session-participants/{session_participant_id}",
    status_code=204,
)
async def remove_session_participant(
    session_participant_id: str,
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
    await remove_counseling_participant_handler(
        event_group_id=ctx.event_group_id,
        session_participant_id=session_participant_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/cases/{case_id}/add-sessions",
    response_model=AddSessionsResponse,
    status_code=201,
)
async def add_sessions_to_case(
    case_id: str,
    data: AddSessionsRequest,
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
    from app.application.handlers.counseling import add_sessions_to_case_handler

    return await add_sessions_to_case_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        case_id=case_id,
        data=data,
        uow=ctx.uow,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/sessions/batch-update/validate",
    response_model=BulkSessionValidateResponse,
)
async def validate_bulk_update_sessions(
    data: BulkSessionUpdateRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    from app.application.handlers.counseling import (
        validate_bulk_update_sessions_handler,
    )

    return await validate_bulk_update_sessions_handler(
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        owner_scope=ctx.owner_scope,
    )


@router.patch(
    "/sessions/batch-update",
    response_model=BulkSessionUpdateResponse,
)
async def bulk_update_sessions(
    data: BulkSessionUpdateRequest,
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
    from app.application.handlers.counseling import bulk_update_sessions_handler

    return await bulk_update_sessions_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
