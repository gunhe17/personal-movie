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
from .schemas import CenterNotePreferenceUpdate, CenterNotePreferenceResponse
from .handlers import get_note_preference_handler, upsert_note_preference_handler

router = APIRouter(prefix="/centers/{center_id}/note-preferences", tags=["Center Note Preferences"])


@router.get("", response_model=CenterNotePreferenceResponse)
async def get_note_preference(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CENTER),
        )
    ),
):
    return await get_note_preference_handler(center_id=ctx.center_id, uow=ctx.uow)


@router.patch("", response_model=CenterNotePreferenceResponse)
async def upsert_note_preference(
    data: CenterNotePreferenceUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CENTER),
            dispatch_events(),
        )
    ),
):
    return await upsert_note_preference_handler(
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )
