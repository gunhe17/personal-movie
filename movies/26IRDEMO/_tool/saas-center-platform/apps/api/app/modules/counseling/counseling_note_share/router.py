from fastapi import APIRouter, Depends

from app.application.handlers.counseling import generate_guardian_share_handler
from app.behavior import (
    ServerContext,
    authenticate,
    behavior,
    dispatch_events,
    require_membership,
    require_permission,
    require_quota,
    start_event_group,
)
from app.core.permissions import Permission
from app.modules.llm.credit_balance.plan_config import AIPurpose

from .handlers import (
    list_shares_handler,
    set_share_visibility_handler,
    update_share_handler,
)
from .schemas import (
    CounselingNoteShareResponse,
    NoteShareGenerateRequest,
    NoteShareUpdateRequest,
)

router = APIRouter(
    prefix="/centers/{center_id}/counseling", tags=["Counseling - Note Shares"]
)


@router.get(
    "/sessions/{session_id}/note-shares",
    response_model=list[CounselingNoteShareResponse],
)
async def list_note_shares(
    session_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    return await list_shares_handler(
        session_id=session_id,
        center_id=ctx.center_id,
        counselor_id=ctx.owner_scope,
        uow=ctx.uow,
    )


@router.post(
    "/sessions/{session_id}/note-shares/generate",
    status_code=201,
    response_model=CounselingNoteShareResponse,
    description="생성만으로는 앱에 보이지 않는다 — 발행(publish)이 노출 스위치.",
)
async def generate_note_share(
    session_id: str,
    data: NoteShareGenerateRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
            require_quota(AIPurpose.COUNSELING_GUARDIAN_SHARE),
            dispatch_events(),
        )
    ),
):
    return await generate_guardian_share_handler(
        event_group_id=ctx.event_group_id,
        session_id=session_id,
        client_id=data.client_id,
        center_id=ctx.center_id,
        counselor_id=ctx.owner_scope,
        author_id=ctx.actor_id,
        audience=data.audience,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.patch(
    "/note-shares/{share_id}",
    response_model=CounselingNoteShareResponse,
)
async def update_note_share(
    share_id: str,
    data: NoteShareUpdateRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
            dispatch_events(),
        )
    ),
):
    return await update_share_handler(
        event_group_id=ctx.event_group_id,
        share_id=share_id,
        center_id=ctx.center_id,
        counselor_id=ctx.owner_scope,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/note-shares/{share_id}/publish",
    response_model=CounselingNoteShareResponse,
)
async def publish_note_share(
    share_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
            dispatch_events(),
        )
    ),
):
    return await set_share_visibility_handler(
        event_group_id=ctx.event_group_id,
        share_id=share_id,
        center_id=ctx.center_id,
        counselor_id=ctx.owner_scope,
        published=True,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/note-shares/{share_id}/unpublish",
    response_model=CounselingNoteShareResponse,
)
async def unpublish_note_share(
    share_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
            dispatch_events(),
        )
    ),
):
    return await set_share_visibility_handler(
        event_group_id=ctx.event_group_id,
        share_id=share_id,
        center_id=ctx.center_id,
        counselor_id=ctx.owner_scope,
        published=False,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
