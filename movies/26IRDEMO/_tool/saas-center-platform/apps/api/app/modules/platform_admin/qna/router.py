from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.modules.platform_admin.auth.dependencies import ADMIN_PLUS
from app.modules.platform_admin.qna.schemas import (
    InquiryAnswerRequest,
    InquiryStatusRequest,
    InquiryDetailResponse,
    InquiryListResponse,
    FAQCreate,
    FAQUpdate,
    FAQReorderRequest,
    FAQDetailResponse,
    FAQListResponse,
)
from app.modules.platform_admin.qna.handlers.inquiry.list_inquiries import (
    list_inquiries_handler,
)
from app.modules.platform_admin.qna.handlers.inquiry.get_inquiry import (
    get_inquiry_handler,
)
from app.application.handlers.support.answer_inquiry import (
    answer_inquiry_handler,
)
from app.modules.platform_admin.qna.handlers.inquiry.update_inquiry_status import (
    update_inquiry_status_handler,
)
from app.modules.platform_admin.qna.handlers.inquiry.delete_inquiry import (
    delete_inquiry_handler,
)
from app.modules.platform_admin.qna.handlers.faq.list_faqs import list_faqs_handler
from app.modules.platform_admin.qna.handlers.faq.get_faq import get_faq_handler
from app.modules.platform_admin.qna.handlers.faq.create_faq import create_faq_handler
from app.modules.platform_admin.qna.handlers.faq.update_faq import update_faq_handler
from app.modules.platform_admin.qna.handlers.faq.delete_faq import delete_faq_handler
from app.modules.platform_admin.qna.handlers.faq.reorder_faqs import (
    reorder_faqs_handler,
)

inquiry_router = APIRouter(tags=["Admin - 문의 관리"])
faq_router = APIRouter(tags=["Admin - FAQ 관리"])


@inquiry_router.get("/", response_model=InquiryListResponse)
async def list_inquiries(
    inquiry_type: str | None = Query(default=None, description="유형 필터"),
    status: str | None = Query(default=None, description="상태 필터"),
    search: str | None = Query(default=None, description="제목/내용/발신자 검색"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_inquiries_handler(
        ctx.uow,
        inquiry_type=inquiry_type,
        status=status,
        search=search,
        page=page,
        size=size,
    )


@inquiry_router.get("/{inquiry_id}", response_model=InquiryDetailResponse)
async def get_inquiry(
    inquiry_id: str,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_inquiry_handler(inquiry_id, ctx.uow)


@inquiry_router.patch(
    "/{inquiry_id}/answer",
    response_model=InquiryDetailResponse,
)
async def answer_inquiry(
    inquiry_id: str,
    data: InquiryAnswerRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await answer_inquiry_handler(
        inquiry_id=inquiry_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@inquiry_router.patch(
    "/{inquiry_id}/status",
    response_model=InquiryDetailResponse,
)
async def update_inquiry_status(
    inquiry_id: str,
    data: InquiryStatusRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await update_inquiry_status_handler(
        inquiry_id=inquiry_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@inquiry_router.delete("/{inquiry_id}")
async def delete_inquiry(
    inquiry_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_inquiry_handler(
        inquiry_id=inquiry_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@faq_router.get("/", response_model=FAQListResponse)
async def list_faqs(
    category: str | None = Query(default=None, description="카테고리 필터"),
    is_published: bool | None = Query(default=None, description="게시 여부 필터"),
    search: str | None = Query(default=None, description="질문/답변 검색"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_faqs_handler(
        ctx.uow,
        category=category,
        is_published=is_published,
        search=search,
        page=page,
        size=size,
    )


@faq_router.post("/reorder")
async def reorder_faqs(
    data: FAQReorderRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await reorder_faqs_handler(
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@faq_router.get("/{faq_id}", response_model=FAQDetailResponse)
async def get_faq(
    faq_id: str,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_faq_handler(faq_id, ctx.uow)


@faq_router.post("/", response_model=FAQDetailResponse, status_code=201)
async def create_faq(
    data: FAQCreate,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await create_faq_handler(
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@faq_router.patch("/{faq_id}", response_model=FAQDetailResponse)
async def update_faq(
    faq_id: str,
    data: FAQUpdate,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await update_faq_handler(
        faq_id=faq_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@faq_router.delete("/{faq_id}")
async def delete_faq(
    faq_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_faq_handler(
        faq_id=faq_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


router = APIRouter()
router.include_router(inquiry_router, prefix="/inquiries")
router.include_router(faq_router, prefix="/faqs")
