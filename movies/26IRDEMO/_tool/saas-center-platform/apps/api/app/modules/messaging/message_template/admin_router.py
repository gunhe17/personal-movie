from fastapi import APIRouter, Depends, Query

from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from app.modules.platform_admin.admin_account.models import AdminRole

from .handlers import (
    create_message_template_handler,
    update_message_template_handler,
    delete_message_template_handler,
    get_message_template_handler,
    get_accessible_message_template_handler,
    preview_message_template_handler,
)
from .handlers.list_system_message_templates import list_system_message_templates_handler
from .handlers.list_message_templates import list_message_templates_handler
from .schemas import (
    MessageTemplateCreate,
    MessageTemplateUpdate,
    MessageTemplateResponse,
    MessageTemplateListResponse,
    MessageTemplatePreviewRequest,
    MessageTemplatePreviewResponse,
)

admin_router = APIRouter(
    prefix="/message-templates",
    tags=["Admin - Message Templates"],
)


# 시스템 기본 양식 관리

@admin_router.get("/system", response_model=MessageTemplateListResponse)
async def list_system_templates(
    template_type: str | None = Query(default=None),
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    """시스템 기본 양식 목록"""
    return await list_system_message_templates_handler(ctx.uow, template_type)


@admin_router.post("/system", response_model=MessageTemplateResponse, status_code=201)
async def create_system_template(
    data: MessageTemplateCreate,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    """시스템 기본 양식 생성"""
    return await create_message_template_handler(
        event_group_id=ctx.event_group_id, center_id=None, data=data, uow=ctx.uow,
        actor_id=ctx.admin_account_id,
        actor_type="admin",
    )


@admin_router.get("/system/{template_id}", response_model=MessageTemplateResponse)
async def get_system_template(
    template_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    """시스템 기본 양식 상세"""
    return await get_message_template_handler(None, template_id, ctx.uow)


@admin_router.put("/system/{template_id}", response_model=MessageTemplateResponse)
async def update_system_template(
    template_id: str,
    data: MessageTemplateUpdate,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    """시스템 기본 양식 수정"""
    return await update_message_template_handler(
        event_group_id=ctx.event_group_id, center_id=None, template_id=template_id, data=data, uow=ctx.uow,
        actor_id=ctx.admin_account_id,
        actor_type="admin",
    )


@admin_router.delete("/system/{template_id}")
async def delete_system_template(
    template_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    """시스템 기본 양식 삭제"""
    return await delete_message_template_handler(
        event_group_id=ctx.event_group_id, center_id=None, template_id=template_id, uow=ctx.uow,
        actor_id=ctx.admin_account_id,
        actor_type="admin",
    )


# 센터별 양식 조회

@admin_router.get("/centers/{center_id}", response_model=MessageTemplateListResponse)
async def list_center_templates(
    center_id: str,
    template_type: str | None = Query(default=None),
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    """특정 센터 양식 목록 조회 (시스템 양식 포함)"""
    return await list_message_templates_handler(center_id, ctx.uow, template_type)


@admin_router.get("/centers/{center_id}/{template_id}", response_model=MessageTemplateResponse)
async def get_center_template(
    center_id: str,
    template_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    """특정 센터 양식 상세 조회 (시스템 양식 포함)"""
    return await get_accessible_message_template_handler(center_id, template_id, ctx.uow)


@admin_router.post("/preview", response_model=MessageTemplatePreviewResponse)
async def preview_template(
    data: MessageTemplatePreviewRequest,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    """양식 미리보기"""
    return await preview_message_template_handler(data, ctx.uow)
