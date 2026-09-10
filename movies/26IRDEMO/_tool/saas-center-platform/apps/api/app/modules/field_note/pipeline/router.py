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
from app.application.handlers.field_note import generate_counseling_note_handler
from ..field_note.schemas import FieldNoteDetailResponse
from .schemas import GenerateCounselingNoteRequest, PipelineStepResponse
from .handlers import (
    transcribe_handler,
    refine_handler,
    diarize_handler,
    generate_summary_handler,
    run_pipeline_handler,
    retry_pipeline_handler,
)

router = APIRouter(prefix="/centers/{center_id}/field-notes", tags=["Field Notes Pipeline"])


@router.post(
    "/{field_note_id}/transcribe",
    response_model=PipelineStepResponse,
)
async def transcribe(
    field_note_id: str,
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
    return await transcribe_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        member_id=ctx.actor_id,
    )


@router.post(
    "/{field_note_id}/refine",
    response_model=PipelineStepResponse,
)
async def refine(
    field_note_id: str,
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
    return await refine_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        member_id=ctx.actor_id,
    )


@router.post(
    "/{field_note_id}/diarize",
    response_model=PipelineStepResponse,
)
async def diarize(
    field_note_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
            require_feature("ai_field_note"),
            dispatch_events(),
        )
    ),
):
    return await diarize_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        member_id=ctx.actor_id,
    )


@router.post(
    "/{field_note_id}/generate-summary",
    response_model=PipelineStepResponse,
)
async def generate_summary(
    field_note_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
            require_feature("ai_field_note"),
            dispatch_events(),
        )
    ),
):
    return await generate_summary_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        member_id=ctx.actor_id,
    )


@router.post(
    "/{field_note_id}/generate-counseling-note",
    response_model=PipelineStepResponse,
)
async def generate_counseling_note(
    field_note_id: str,
    data: GenerateCounselingNoteRequest | None = Body(None),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
            require_feature("ai_field_note"),
            dispatch_events(),
        )
    ),
):
    return await generate_counseling_note_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        author_id=ctx.actor_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        note_template_type=data.note_template_type if data else None,
    )


@router.post(
    "/{field_note_id}/run-pipeline",
    response_model=PipelineStepResponse,
)
async def run_pipeline(
    field_note_id: str,
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
    return await run_pipeline_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        member_id=ctx.actor_id,
    )


@router.post(
    "/{field_note_id}/retry-pipeline",
    response_model=FieldNoteDetailResponse,
)
async def retry_pipeline(
    field_note_id: str,
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
    return await retry_pipeline_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        member_id=ctx.actor_id,
    )
