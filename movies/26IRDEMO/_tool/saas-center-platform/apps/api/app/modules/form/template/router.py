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
from fastapi.responses import StreamingResponse

from app.core.permissions import Permission
from app.modules.form.template.schemas import (
    FormDraftResponse,
    GenerateDraftRequest,
    TemplateCloneCreate,
    TemplateCreate,
    TemplateDraftUpdate,
    TemplateListResponse,
    TemplateResponse,
    TemplateStatusUpdate,
    TemplateVersionCreate,
)
from app.modules.form.template.handlers.create_form_template import create_form_template_handler
from app.application.handlers.form.generate_draft import generate_draft_handler
from app.application.handlers.form.get_template_page_image import (
    get_template_page_image_handler,
)
from app.modules.form.template.handlers.clone_form_template import clone_form_template_handler
from app.modules.form.template.handlers.create_form_template_version import (
    create_form_template_version_handler,
)
from app.modules.form.template.handlers.get_form_template import get_form_template_handler
from app.modules.form.template.handlers.list_form_templates import list_form_templates_handler
from app.modules.form.template.handlers.deactivate_form_template import (
    deactivate_form_template_handler,
)
from app.modules.form.template.handlers.set_form_template_status import (
    set_form_template_status_handler,
)
from app.modules.form.template.handlers.publish_form_template import publish_form_template_handler
from app.modules.form.template.handlers.update_form_template_draft import (
    update_form_template_draft_handler,
)

router = APIRouter(
    prefix="/centers/{center_id}/forms/templates",
    tags=["Form - Templates"],
)


@router.get(
    "/",
    response_model=TemplateListResponse,
)
async def list_templates(
    include_system: bool = Query(True, description="시스템 템플릿 포함 여부"),
    include_inactive: bool = Query(
        False, description="비활성 템플릿 포함 여부(관리 화면용, 기본 false)"
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_FORM_TEMPLATE),
        )
    ),
):
    return await list_form_templates_handler(
        ctx.center_id, ctx.uow, include_system, include_inactive
    )


@router.get(
    "/{template_id}/pages/{page_no}/image",
    response_class=StreamingResponse,
    description="서식 원본 PNG — 스키마의 pages[].image 는 storage 경로라 브라우저가 직접 못 읽는다.",
)
async def get_template_page_image(
    template_id: str,
    page_no: int,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_FORM_TEMPLATE),
        )
    ),
):
    return await get_template_page_image_handler(
        ctx.center_id, template_id, page_no, ctx.uow
    )


@router.post(
    "/",
    response_model=TemplateResponse,
    status_code=201,
)
async def create_template(
    data: TemplateCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_TEMPLATE),
            dispatch_events(),
        )
    ),
):
    return await create_form_template_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/draft",
    response_model=FormDraftResponse,
)
async def generate_draft(
    data: GenerateDraftRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_TEMPLATE),
        )
    ),
):
    return await generate_draft_handler(ctx.center_id, data.description)


@router.get(
    "/{template_id}",
    response_model=TemplateResponse,
)
async def get_template(
    template_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_FORM_TEMPLATE),
        )
    ),
):
    return await get_form_template_handler(template_id, ctx.center_id, ctx.uow)


@router.put(
    "/{template_id}",
    response_model=TemplateResponse,
)
async def create_template_version(
    template_id: str,
    data: TemplateVersionCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_TEMPLATE),
            dispatch_events(),
        )
    ),
):
    return await create_form_template_version_handler(
        event_group_id=ctx.event_group_id,
        template_id=template_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.patch(
    "/{template_id}",
    response_model=TemplateResponse,
)
async def update_template_draft(
    template_id: str,
    data: TemplateDraftUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_TEMPLATE),
            dispatch_events(),
        )
    ),
):
    return await update_form_template_draft_handler(
        event_group_id=ctx.event_group_id,
        template_id=template_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{template_id}",
    response_model=TemplateResponse,
)
async def deactivate_template(
    template_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_TEMPLATE),
            dispatch_events(),
        )
    ),
):
    return await deactivate_form_template_handler(
        template_id,
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.patch(
    "/{template_id}/status",
    response_model=TemplateResponse,
)
async def set_template_status(
    template_id: str,
    data: TemplateStatusUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_TEMPLATE),
            dispatch_events(),
        )
    ),
):
    return await set_form_template_status_handler(
        template_id,
        ctx.center_id,
        data.is_active,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{template_id}/clone",
    response_model=TemplateResponse,
    status_code=201,
)
async def clone_template(
    template_id: str,
    data: TemplateCloneCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_TEMPLATE),
            dispatch_events(),
        )
    ),
):
    return await clone_form_template_handler(
        template_id,
        ctx.center_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{template_id}/publish",
    response_model=TemplateResponse,
)
async def publish_template(
    template_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_TEMPLATE),
            dispatch_events(),
        )
    ),
):
    return await publish_form_template_handler(
        event_group_id=ctx.event_group_id,
        template_id=template_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
