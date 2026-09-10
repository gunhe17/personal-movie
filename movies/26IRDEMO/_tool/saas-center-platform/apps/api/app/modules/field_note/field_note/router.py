from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    require_feature,
    start_event_group,
    dispatch_events,
    with_dispatcher,
)
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, Path

from app.core.config import settings
from app.core.permissions import Permission
from app.application.handlers.field_note import (
    list_field_notes_with_brief_handler,
    get_field_note_detail_handler,
    generate_recommendation_handler,
    list_linkable_tasks_handler,
    link_task_handler,
    create_field_note_handler,
)
from .schemas import (
    AudioDownloadUrlResponse,
    FieldNoteCreate,
    FieldNoteFinish,
    FieldNoteLinkSchedule,
    FieldNoteLinkTask,
    FieldNoteSpeakerMapUpdate,
    FieldNoteResponse,
    FieldNoteDetailResponse,
    FieldNoteListResponse,
    FieldNoteStatusItem,
    LinkableAssessmentTask,
)
from ..field_note_entry.schemas import FieldNoteEntryCreate, FieldNoteEntryResponse
from ..field_note_audio.schemas import AudioUploadResponse
from ..pipeline.schemas import RecommendationResponse
from .handlers import (
    get_field_note_by_schedule_handler,
    get_field_note_statuses_handler,
    upload_audio_chunk_handler,
    add_entry_handler,
    finish_recording_handler,
    link_schedule_handler,
    get_field_notes_by_task_handler,
    list_unlinked_handler,
    update_speaker_map_handler,
    delete_field_note_handler,
    get_audio_download_url_handler,
    export_transcript_handler,
)

router = APIRouter(prefix="/centers/{center_id}/field-notes", tags=["Field Notes"])


@router.get(
    "/config",
    response_model=dict,
)
async def get_field_note_config():
    mode = (
        "aws_streaming"
        if settings.STT_STREAMING_PROVIDER == "aws_transcribe"
        else "whisper_chunk"
    )
    return {"stt_mode": mode}


@router.post("", status_code=201, response_model=FieldNoteResponse)
async def create_field_note(
    data: FieldNoteCreate,
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
    return await create_field_note_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        author_id=ctx.actor_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        schedule_id=data.schedule_id,
        task_id=data.task_id,
    )


@router.get("", response_model=FieldNoteListResponse)
async def list_field_notes(
    status: str | None = Query(None, description="상태 필터 (recording, completed)"),
    processing_status: str | None = Query(
        None, description="처리 상태 (idle, processing, completed, failed)"
    ),
    analysis_state: str | None = Query(
        None, description="분석 상태 필터 (completed, processing, unanalyzed, failed)"
    ),
    linked: bool | None = Query(None),
    link_type: str | None = Query(
        None,
        pattern="^(schedule|task|none)$",
        description="연결 도메인 필터 (schedule=상담 회기, task=검사 항목, none=미지정)",
    ),
    author_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    # access_level=="own"(상담사 등)은 본인이 작성한 필드노트만 조회 가능.
    # 타인 노트 조회 차단 겸, 모바일/상담사 시점에서 목록을 본인 것으로 한정한다.
    # access_level=="all"(관리자)은 author_id 쿼리로 선택적 필터, 미지정 시 센터 전체.
    effective_author_id = ctx.actor_id if ctx.access_level == "own" else author_id
    return await list_field_notes_with_brief_handler(
        center_id=ctx.center_id,
        uow=ctx.uow,
        status=status,
        processing_status=processing_status,
        analysis_state=analysis_state,
        linked=linked,
        link_type=link_type,
        author_id=effective_author_id,
        page=page,
        size=size,
    )


@router.get("/unlinked", response_model=list[FieldNoteResponse])
async def list_unlinked(
    analysis_state: str | None = Query(
        None, description="분석 상태 필터 (completed, processing, unanalyzed, failed)"
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    return await list_unlinked_handler(
        center_id=ctx.center_id,
        author_id=ctx.actor_id,
        uow=ctx.uow,
        analysis_state=analysis_state,
    )


@router.get(
    "/linkable-tasks",
    response_model=list[LinkableAssessmentTask],
)
async def list_linkable_tasks(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    return await list_linkable_tasks_handler(center_id=ctx.center_id, uow=ctx.uow)


@router.get("/statuses", response_model=list[FieldNoteStatusItem])
async def get_field_note_statuses(
    schedule_ids: str = Query(..., description="일정 ID 목록 (쉼표 구분)"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    ids = [sid.strip() for sid in schedule_ids.split(",") if sid.strip()]
    return await get_field_note_statuses_handler(
        schedule_ids=ids, center_id=ctx.center_id, uow=ctx.uow
    )


@router.get("/{field_note_id}", response_model=FieldNoteDetailResponse)
async def get_field_note(
    field_note_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    return await get_field_note_detail_handler(
        field_note_id=field_note_id, center_id=ctx.center_id, uow=ctx.uow
    )


@router.get(
    "/by-schedule/{schedule_id}",
    response_model=FieldNoteDetailResponse | None,
)
async def get_field_note_by_schedule(
    schedule_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    return await get_field_note_by_schedule_handler(
        schedule_id=schedule_id, center_id=ctx.center_id, uow=ctx.uow
    )


@router.post(
    "/{field_note_id}/entries", status_code=201, response_model=FieldNoteEntryResponse
)
async def add_entry(
    field_note_id: str,
    data: FieldNoteEntryCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
        )
    ),
):
    return await add_entry_handler(
        field_note_id=field_note_id, center_id=ctx.center_id, data=data, uow=ctx.uow
    )


@router.post(
    "/{field_note_id}/audio", status_code=201, response_model=AudioUploadResponse
)
async def upload_audio_chunk(
    field_note_id: str,
    file: UploadFile = File(...),
    duration: float = Form(...),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
            with_dispatcher(),
        )
    ),
):
    return await upload_audio_chunk_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        file=file,
        duration=duration,
        uow=ctx.uow,
        dispatcher=ctx.dispatcher,
        member_id=ctx.actor_id,
    )


@router.get(
    "/{field_note_id}/audio/{audio_id}/download-url",
    response_model=AudioDownloadUrlResponse,
)
async def get_audio_download_url(
    field_note_id: str = Path(...),
    audio_id: str = Path(...),
    expires_in: int = Query(3600, ge=60, le=604800),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    return await get_audio_download_url_handler(
        field_note_id=field_note_id,
        audio_id=audio_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        expires_in=expires_in,
    )


@router.post("/{field_note_id}/finish", response_model=FieldNoteResponse)
async def finish_recording(
    field_note_id: str,
    data: FieldNoteFinish,
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
    return await finish_recording_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        member_id=ctx.actor_id,
    )


@router.post("/{field_note_id}/link-schedule", response_model=FieldNoteResponse)
async def link_schedule(
    field_note_id: str,
    data: FieldNoteLinkSchedule,
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
    return await link_schedule_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        schedule_id=data.schedule_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{field_note_id}/link-task",
    response_model=FieldNoteResponse,
)
async def link_task(
    field_note_id: str,
    data: FieldNoteLinkTask,
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
    return await link_task_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        task_id=data.task_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/by-task/{task_id}",
    response_model=list[FieldNoteStatusItem],
)
async def get_field_notes_by_task(
    task_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    return await get_field_notes_by_task_handler(
        task_id=task_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
    )


@router.patch("/{field_note_id}/speaker-map", response_model=FieldNoteResponse)
async def update_speaker_map(
    field_note_id: str,
    data: FieldNoteSpeakerMapUpdate,
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
    return await update_speaker_map_handler(
        event_group_id=ctx.event_group_id,
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post("/{field_note_id}/recommend", response_model=RecommendationResponse)
async def generate_recommendation(
    field_note_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING_NOTE),
            require_feature("ai_field_note"),
        )
    ),
):
    return await generate_recommendation_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        member_id=ctx.actor_id,
    )


@router.get("/{field_note_id}/export", response_model=dict)
async def export_transcript(
    field_note_id: str,
    format: str = Query("text", description="내보내기 형식 (text, json)"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    result = await export_transcript_handler(
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        format=format,
        uow=ctx.uow,
    )
    return {
        "content": result.content,
        "format": result.format,
        "filename": result.filename,
    }


@router.delete("/{field_note_id}", status_code=204)
async def delete_field_note(
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
    await delete_field_note_handler(
        event_group_id=ctx.event_group_id,
        field_note_id=field_note_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
