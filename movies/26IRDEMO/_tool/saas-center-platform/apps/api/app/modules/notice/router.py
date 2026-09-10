from datetime import date

from fastapi import APIRouter, Depends, Query

from app.behavior import behavior, UnscopedContext, authenticate
from app.application.handlers.notice import get_notice_handler, list_notices_handler
from .notice.schemas import NoticeDetailResponse, NoticeListResponse

router = APIRouter(prefix="/notices", tags=["공지사항"])


@router.get("/", response_model=NoticeListResponse)
async def list_notices(
    search: str | None = Query(default=None, description="제목 검색"),
    category: str | None = Query(
        default=None, description="유형 필터 (maintenance, update, announcement)"
    ),
    date_from: date | None = Query(
        default=None, description="게시일 시작 (YYYY-MM-DD)"
    ),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=20, ge=1, le=100, description="페이지 크기"),
    center_id: str | None = Query(
        default=None, description="센터 ID (읽음 상태 조회용)"
    ),
    ctx: UnscopedContext = Depends(behavior.request_unscoped(authenticate())),
):
    return await list_notices_handler(
        ctx.uow,
        person_id=ctx.person_id,
        center_id=center_id,
        search=search,
        category=category,
        date_from=date_from,
        page=page,
        size=size,
    )


@router.get("/{notice_id}", response_model=NoticeDetailResponse)
async def get_notice(
    notice_id: str,
    center_id: str | None = Query(default=None, description="센터 ID (읽음 기록용)"),
    ctx: UnscopedContext = Depends(behavior.request_unscoped(authenticate())),
):
    return await get_notice_handler(
        notice_id, ctx.uow, person_id=ctx.person_id, center_id=center_id
    )
