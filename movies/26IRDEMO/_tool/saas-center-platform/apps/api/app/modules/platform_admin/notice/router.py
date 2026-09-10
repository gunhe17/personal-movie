from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query, UploadFile, File

from app.core.schemas import DetailResponse
from app.modules.platform_admin.auth.dependencies import ADMIN_PLUS
from app.modules.notice.notice.schemas import (
    NoticeCreate,
    NoticeUpdate,
    NoticeDetailResponse,
)
from app.modules.platform_admin.notice.schemas import (
    AdminNoticeListResponse,
    AttachmentUploadResponse,
    NotifyNoticeWrappedResponse,
)
from app.modules.platform_admin.notice.handlers.list_admin_notices import (
    list_admin_notices_handler,
)
from app.modules.platform_admin.notice.handlers.get_admin_notice import (
    get_admin_notice_handler,
)
from app.application.handlers.notice.create_admin_notice import (
    create_admin_notice_handler,
)
from app.application.handlers.notice.delete_admin_notice import (
    delete_admin_notice_handler,
)
from app.modules.platform_admin.notice.handlers.upload_notice_attachment import (
    upload_notice_attachment_handler,
)
from app.application.handlers.notice import (
    remind_unread_members_handler,
    update_admin_notice_handler,
)

router = APIRouter(tags=["Admin - 공지사항"])


@router.get("/", response_model=AdminNoticeListResponse)
async def list_notices(
    category: str | None = Query(
        default=None, description="유형 필터 (maintenance, update, announcement)"
    ),
    is_published: bool | None = Query(default=None, description="게시 상태 필터"),
    search: str | None = Query(default=None, description="제목 검색"),
    sort_order: str = Query(default="desc", description="날짜 정렬 (asc, desc)"),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=20, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_admin_notices_handler(
        ctx.uow,
        category=category,
        is_published=is_published,
        search=search,
        sort_order=sort_order,
        page=page,
        size=size,
    )


@router.get("/{notice_id}", response_model=NoticeDetailResponse)
async def get_notice(
    notice_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_admin_notice_handler(notice_id, ctx.uow)


@router.post(
    "/",
    response_model=NoticeDetailResponse,
    status_code=201,
)
async def create_notice(
    data: NoticeCreate,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await create_admin_notice_handler(
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.patch("/{notice_id}", response_model=NoticeDetailResponse)
async def update_notice(
    notice_id: str,
    data: NoticeUpdate,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await update_admin_notice_handler(
        notice_id=notice_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.delete("/{notice_id}", response_model=DetailResponse)
async def delete_notice(
    notice_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_admin_notice_handler(
        notice_id=notice_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{notice_id}/remind",
    response_model=NotifyNoticeWrappedResponse,
)
async def remind_unread_members(
    notice_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await remind_unread_members_handler(
        notice_id=notice_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post("/attachments/upload", response_model=AttachmentUploadResponse)
async def upload_notice_attachment(
    file: UploadFile = File(..., description="첨부할 파일"),
    notice_id: str = Query(
        default="draft", description="공지사항 ID (새 작성시 'draft')"
    ),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await upload_notice_attachment_handler(file=file, notice_id=notice_id)
