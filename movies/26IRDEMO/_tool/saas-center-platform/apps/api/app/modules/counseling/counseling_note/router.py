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
from app.application.schemas import CounselingNoteListResponse
from .schemas import (
    CounselingNoteCreate,
    CounselingNoteUpdate,
    CounselingNoteResponse,
)
from .handlers import (
    create_note_handler,
    list_notes_handler,
    get_note_handler,
    update_note_handler,
    delete_note_handler,
)

router = APIRouter(
    prefix="/centers/{center_id}/counseling", tags=["Counseling - Notes"]
)


@router.post(
    "/sessions/{session_id}/notes",
    status_code=201,
    response_model=CounselingNoteResponse,
)
async def create_note(
    session_id: str,
    data: CounselingNoteCreate,
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
    counselor_id = ctx.owner_scope
    return await create_note_handler(
        event_group_id=ctx.event_group_id,
        session_id=session_id,
        client_id=data.client_id,
        center_id=ctx.center_id,
        author_id=ctx.actor_id,
        counselor_id=counselor_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/sessions/{session_id}/notes",
    response_model=list[CounselingNoteResponse],
)
async def list_notes(
    session_id: str,
    client_id: str | None = Query(None, description="내담자 ID 필터 (선택)"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    counselor_id = ctx.owner_scope
    return await list_notes_handler(
        session_id, ctx.center_id, counselor_id, client_id, ctx.actor_id, ctx.uow
    )


# 주의: 정적 경로이므로 /notes/{note_id} 보다 먼저 선언해야 매칭 충돌이 없다.
@router.get(
    "/notes",
    response_model=CounselingNoteListResponse,
)
async def list_my_notes(
    status: str = Query("all", description="all | written | missing"),
    keyword: str | None = Query(None, description="내담자 이름 검색"),
    program_type: str | None = Query(
        None, description="프로그램 유형 INDIVIDUAL | GROUP (미지정 = 전체)"
    ),
    skip: int = Query(0, ge=0, description="페이지네이션 오프셋"),
    limit: int = Query(30, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    from app.application.handlers.counseling import list_my_counseling_notes_handler

    return await list_my_counseling_notes_handler(
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        status=status,
        keyword=keyword,
        program_type=program_type,
        skip=skip,
        limit=limit,
        uow=ctx.uow,
    )


@router.get(
    "/notes/{note_id}",
    response_model=CounselingNoteResponse,
)
async def get_note(
    note_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING_NOTE),
        )
    ),
):
    counselor_id = ctx.owner_scope
    return await get_note_handler(
        note_id, ctx.center_id, counselor_id, ctx.actor_id, ctx.uow
    )


@router.patch(
    "/notes/{note_id}",
    response_model=CounselingNoteResponse,
)
async def update_note(
    note_id: str,
    data: CounselingNoteUpdate,
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
    counselor_id = ctx.owner_scope
    return await update_note_handler(
        event_group_id=ctx.event_group_id,
        note_id=note_id,
        center_id=ctx.center_id,
        counselor_id=counselor_id,
        viewer_member_id=ctx.actor_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/notes/{note_id}",
    status_code=204,
)
async def delete_note(
    note_id: str,
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
    counselor_id = ctx.owner_scope
    await delete_note_handler(
        event_group_id=ctx.event_group_id,
        note_id=note_id,
        center_id=ctx.center_id,
        counselor_id=counselor_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
