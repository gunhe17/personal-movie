from fastapi import APIRouter, Depends, Query

from app.behavior import (
    behavior,
    UnscopedContext,
    authenticate,
    start_event_group,
    dispatch_events,
)
from app.application.handlers.support import (
    list_public_faqs_handler,
    list_my_inquiries_handler,
    create_inquiry_handler,
)

from .schemas import (
    InquiryCreate,
    InquiryListResponse,
    InquiryResponse,
    PublicFAQListResponse,
)

router = APIRouter(prefix="/support", tags=["Support"])


@router.get(
    "/faqs",
    response_model=PublicFAQListResponse,
)
async def list_public_faqs(
    category: str | None = Query(default=None, description="카테고리 필터"),
    search: str | None = Query(default=None, description="질문/답변 검색"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=100, ge=1, le=200),
    *,
    ctx: UnscopedContext = Depends(behavior.request_unscoped()),
):
    return await list_public_faqs_handler(
        category=category,
        search=search,
        page=page,
        size=size,
        uow=ctx.uow,
    )


@router.get(
    "/inquiries",
    response_model=InquiryListResponse,
)
async def list_my_inquiries(
    center_id: str | None = Query(default=None, description="센터 ID"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
        )
    ),
):
    return await list_my_inquiries_handler(
        account_id=ctx.account_id,
        center_id=center_id,
        page=page,
        size=size,
        uow=ctx.uow,
    )


@router.post("/inquiry", response_model=InquiryResponse)
async def create_inquiry(
    data: InquiryCreate,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            authenticate(),
            dispatch_events(),
        )
    ),
):
    return await create_inquiry_handler(
        event_group_id=ctx.event_group_id,
        actor_id=ctx.account_id,
        data=data,
        uow=ctx.uow,
    )
