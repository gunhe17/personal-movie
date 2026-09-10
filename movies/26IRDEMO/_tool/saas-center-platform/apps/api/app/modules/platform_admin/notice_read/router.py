from app.behavior import behavior, AdminContext, authenticate_admin
from fastapi import APIRouter, Depends, Query

from app.modules.platform_admin.notice_read.schemas import (
    NoticeReadStatusResponse,
    NoticeReadCenterDetailResponse,
)
from app.modules.platform_admin.notice_read.handlers.get_read_status import (
    get_read_status_handler,
)
from app.modules.platform_admin.notice_read.handlers.get_center_read_detail import (
    get_center_read_detail_handler,
)

router = APIRouter(tags=["Admin - 공지사항 읽음 현황"])


@router.get(
    "/{notice_id}/read-status",
    response_model=NoticeReadStatusResponse,
)
async def get_read_status(
    notice_id: str,
    search: str | None = Query(None, description="센터명 검색"),
    is_read: bool | None = Query(None, description="읽음 여부 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(10, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_read_status_handler(
        notice_id, ctx.uow, search=search, is_read=is_read, page=page, size=size
    )


@router.get(
    "/{notice_id}/read-status/{center_id}",
    response_model=NoticeReadCenterDetailResponse,
)
async def aggregate_center_read_detail(
    notice_id: str,
    center_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_center_read_detail_handler(notice_id, center_id, ctx.uow)
