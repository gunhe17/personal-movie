from fastapi import APIRouter, Depends, Query

from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    start_event_group,
    dispatch_events,
)
from app.core.schemas import MessageResponse

from .handlers import (
    create_message_template_handler,
    update_message_template_handler,
    delete_message_template_handler,
    list_message_templates_handler,
    get_accessible_message_template_handler,
    set_default_message_template_handler,
    get_default_message_template_handler,
    preview_message_template_handler,
)
from .schemas import (
    MessageTemplateCreate,
    MessageTemplateUpdate,
    MessageTemplateResponse,
    MessageTemplateListResponse,
    MessageTemplatePreviewRequest,
    MessageTemplatePreviewResponse,
    DefaultTemplateResponse,
)

router = APIRouter(
    prefix="/centers/{center_id}/message-templates",
    tags=["Message Templates"],
)


@router.get("/", response_model=MessageTemplateListResponse)
async def list_templates(
    template_type: str | None = Query(default=None, description="양식 타입 필터"),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_message_templates_handler(ctx.center_id, ctx.uow, template_type)


@router.get("/default", response_model=DefaultTemplateResponse)
async def get_default_template(
    template_type: str = Query(description="양식 타입"),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await get_default_message_template_handler(ctx.center_id, template_type, ctx.uow)


@router.get("/{template_id}", response_model=MessageTemplateResponse)
async def get_template(
    template_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await get_accessible_message_template_handler(ctx.center_id, template_id, ctx.uow)


@router.post("/", response_model=MessageTemplateResponse, status_code=201)
async def create_template(
    data: MessageTemplateCreate,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await create_message_template_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.patch("/{template_id}", response_model=MessageTemplateResponse)
async def update_template(
    template_id: str,
    data: MessageTemplateUpdate,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await update_message_template_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        template_id=template_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete("/{template_id}", response_model=MessageResponse)
async def delete_template(
    template_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await delete_message_template_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        template_id=template_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post("/{template_id}/set-default", response_model=MessageTemplateResponse)
async def set_default(
    template_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await set_default_message_template_handler(
        ctx.center_id,
        template_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.post("/preview", response_model=MessageTemplatePreviewResponse)
async def preview_template(
    data: MessageTemplatePreviewRequest,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await preview_message_template_handler(data, ctx.uow)
