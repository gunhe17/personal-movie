from fastapi import APIRouter, Depends

from app.behavior import (
    ServerContext,
    authenticate,
    behavior,
    require_membership,
    require_permission,
)
from app.core.permissions import Permission

from .handlers import list_drafts_handler
from .schemas import CounselingNoteAiDraftResponse

router = APIRouter(prefix="/centers/{center_id}/counseling", tags=["Counseling - AI Note Drafts"])


@router.get(
    "/sessions/{session_id}/ai-drafts",
    response_model=list[CounselingNoteAiDraftResponse],
)
async def list_ai_drafts(
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
    return await list_drafts_handler(
        session_id=session_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
    )
