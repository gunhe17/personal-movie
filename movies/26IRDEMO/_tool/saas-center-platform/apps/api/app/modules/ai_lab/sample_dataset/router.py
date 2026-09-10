from fastapi import APIRouter, Depends, Query, UploadFile, File

from app.behavior import behavior, AdminContext, UnscopedContext, authenticate_admin, require_role, start_event_group, dispatch_events
from app.core.schemas import OkResponse
from app.modules.platform_admin.admin_account.models import AdminRole
from app.application.handlers.ai_lab.list_field_note_candidates import (
    list_field_note_candidates_handler,
)
from app.application.handlers.ai_lab.import_field_note_sample import (
    import_field_note_sample_handler,
)
from .handlers import (
    create_text_sample_handler,
    upload_audio_sample_handler,
    list_samples_handler,
    get_sample_handler,
    update_sample_handler,
    update_sample_reference_handler,
    delete_sample_handler,
    get_sample_audio_url_handler,
)
from .schemas import (
    SampleDatasetCreate,
    SampleDatasetUpdate,
    SampleDatasetResponse,
    SampleDatasetListResponse,
    SampleAudioUrlResponse,
    FieldNoteCandidateListResponse,
    ImportFieldNoteSampleRequest,
    ReferenceSegmentsUpdate,
)

router = APIRouter(prefix="/internal/ai-lab/samples", tags=["AI Lab - Samples"])


@router.post("", response_model=SampleDatasetResponse)
async def create_text_sample(
    data: SampleDatasetCreate,
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
    return await create_text_sample_handler(
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.post("/upload-audio", response_model=SampleDatasetResponse)
async def upload_audio_sample(
    file: UploadFile = File(...),
    name: str = Query(...),
    description: str | None = Query(None),
    tags: str | None = Query(None),
    source_type: str = Query("manual"),
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
    return await upload_audio_sample_handler(
        file_content=await file.read(),
        filename=file.filename,
        content_type=file.content_type,
        name=name,
        description=description,
        tags=tags,
        source_type=source_type,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.get(
    "/field-note-candidates",
    response_model=FieldNoteCandidateListResponse,
)
async def list_field_note_candidates(
    limit: int = Query(50, ge=1, le=200),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await list_field_note_candidates_handler(limit=limit, uow=ctx.uow)


@router.post(
    "/from-field-note",
    response_model=SampleDatasetResponse,
)
async def import_field_note_sample(
    data: ImportFieldNoteSampleRequest,
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
    return await import_field_note_sample_handler(
        field_note_id=data.field_note_id,
        name=data.name,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.get("", response_model=SampleDatasetListResponse)
async def list_samples(
    input_type: str | None = None,
    tags: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await list_samples_handler(input_type, tags, page, size, ctx.uow)


@router.get("/{sample_id}", response_model=SampleDatasetResponse)
async def get_sample(
    sample_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await get_sample_handler(sample_id, ctx.uow)


@router.patch("/{sample_id}", response_model=SampleDatasetResponse)
async def update_sample(
    sample_id: str,
    data: SampleDatasetUpdate,
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
    return await update_sample_handler(
        sample_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.put(
    "/{sample_id}/reference",
    response_model=SampleDatasetResponse,
)
async def set_sample_reference(
    sample_id: str,
    data: ReferenceSegmentsUpdate,
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
    return await update_sample_reference_handler(
        sample_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.delete("/{sample_id}", response_model=OkResponse)
async def delete_sample(
    sample_id: str,
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
    return await delete_sample_handler(
        sample_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.get("/{sample_id}/audio-url", response_model=SampleAudioUrlResponse)
async def get_sample_audio_url(
    sample_id: str,
    expires_in: int = Query(3600, ge=60, le=604800),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await get_sample_audio_url_handler(sample_id, expires_in, ctx.uow)
