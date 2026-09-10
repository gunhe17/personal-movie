from fastapi import APIRouter, Depends, Query

from app.behavior import behavior, AdminContext, UnscopedContext, authenticate_admin, require_role, start_event_group, dispatch_events
from app.core.schemas import OkResponse
from app.modules.platform_admin.admin_account.models import AdminRole
from app.application.handlers.ai_lab.import_production_prompts import (
    import_production_prompts_handler,
)
from .handlers import (
    list_prompts_handler,
    get_prompt_handler,
    create_prompt_handler,
    update_prompt_handler,
    delete_prompt_handler,
)
from .schemas import PromptVersionCreate, PromptVersionUpdate, PromptVersionResponse

router = APIRouter(prefix="/internal/ai-lab/prompts", tags=["AI Lab - Prompts"])


@router.get("", response_model=list[PromptVersionResponse])
async def list_prompts(
    prompt_key: str | None = None,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await list_prompts_handler(prompt_key, ctx.uow)


@router.get("/{prompt_id}", response_model=PromptVersionResponse)
async def get_prompt(
    prompt_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await get_prompt_handler(prompt_id, ctx.uow)


@router.post("", response_model=PromptVersionResponse)
async def create_prompt(
    data: PromptVersionCreate,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await create_prompt_handler(
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.patch("/{prompt_id}", response_model=PromptVersionResponse)
async def update_prompt(
    prompt_id: str,
    data: PromptVersionUpdate,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await update_prompt_handler(
        prompt_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.delete("/{prompt_id}", response_model=OkResponse)
async def delete_prompt(
    prompt_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_prompt_handler(
        prompt_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.post("/import-production", response_model=list[PromptVersionResponse])
async def import_production_prompts(
    module: str = Query("field_note"),
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await import_production_prompts_handler(
        module=module,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )
