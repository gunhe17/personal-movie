from fastapi import APIRouter, Depends, Query

from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    start_event_group,
    dispatch_events,
)

from .handlers import (
    list_notifications_handler,
    get_unread_count_handler,
    mark_as_read_handler,
    mark_all_as_read_handler,
)
from .schemas import (
    NotificationListResponse,
    UnreadCountResponse,
    NotificationResponse,
    MarkAllReadResponse,
)

router = APIRouter(prefix="/centers/{center_id}/notifications", tags=["Notification"])


@router.get(
    "",
    response_model=NotificationListResponse,
)
async def list_notifications(
    category: str | None = Query(
        None, description="대분류 필터 (assessment | counseling | system)"
    ),
    is_read: bool | None = Query(None, description="읽음 여부 필터"),
    search: str | None = Query(None, description="제목/본문 검색"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    sort: str = Query(
        "desc", pattern="^(asc|desc)$", description="생성일 정렬 (asc | desc)"
    ),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_notifications_handler(
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        uow=ctx.uow,
        category=category,
        is_read=is_read,
        search=search,
        page=page,
        size=size,
        sort=sort,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
)
async def get_unread_count(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await get_unread_count_handler(
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        uow=ctx.uow,
    )


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
async def mark_as_read(
    notification_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await mark_as_read_handler(
        notification_id=notification_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
    )


@router.patch(
    "/read-all",
    response_model=MarkAllReadResponse,
)
async def mark_all_as_read(
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await mark_all_as_read_handler(
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
    )


