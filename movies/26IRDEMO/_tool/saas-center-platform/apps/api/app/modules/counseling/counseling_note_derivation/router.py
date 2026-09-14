from fastapi import APIRouter, Depends

from app.application.handlers.counseling import derive_submission_form_handler
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
from app.modules.counseling.facade import CounselingNoteDerivationFacade
from app.modules.llm.credit_balance.plan_config import AIPurpose

from .schemas import (
    CounselingNoteDerivationResponse,
    NoteDerivationCreateRequest,
)

router = APIRouter(
    prefix="/centers/{center_id}/counseling", tags=["Counseling - Note Derivations"]
)


@router.get(
    "/sessions/{session_id}/note-derivations",
    response_model=list[CounselingNoteDerivationResponse],
)
async def list_note_derivations(
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
    rows = await CounselingNoteDerivationFacade(ctx.uow).list_derivations_by_session(
        session_id=session_id,
        center_id=ctx.center_id,
        counselor_id=ctx.owner_scope,
    )
    return [CounselingNoteDerivationResponse.model_validate(r) for r in rows]


@router.post(
    "/sessions/{session_id}/note-derivations",
    status_code=201,
    response_model=CounselingNoteDerivationResponse,
    description="값이 채워진 양식 인스턴스가 함께 태어난다 — 주소는 content.instance_id.",
)
async def derive_submission_form(
    session_id: str,
    data: NoteDerivationCreateRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
            require_quota(AIPurpose.COUNSELING_NOTE_DERIVE),
            dispatch_events(),
        )
    ),
):
    return await derive_submission_form_handler(
        event_group_id=ctx.event_group_id,
        session_id=session_id,
        client_id=data.client_id,
        center_id=ctx.center_id,
        counselor_id=ctx.owner_scope,
        author_id=ctx.actor_id,
        kind=data.kind,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
