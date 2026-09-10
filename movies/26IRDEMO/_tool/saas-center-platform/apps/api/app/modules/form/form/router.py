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

from app.core.permissions import Permission
from app.modules.form.value.schemas import ValuesUpsertRequest, ValuesResponse
from app.modules.form.form.schemas import (
    FormCreate,
    FormListResponse,
    FormResponse,
)
from app.modules.form.signature.schemas import SignatureCreate, SignatureResponse
from app.modules.form.form.handlers.create_instance import create_instance_handler
from app.modules.form.form.handlers.get_instance import get_instance_handler
from app.modules.form.form.handlers.list_instances import list_instances_handler
from app.modules.form.form.handlers.delete_instance import delete_instance_handler
from app.modules.form.form.handlers.upsert_answers import upsert_answers_handler
from app.modules.form.form.handlers.submit_instance import submit_instance_handler
from app.modules.form.form.handlers.revert_instance import revert_instance_handler
from app.modules.form.form.handlers.create_signature import (
    create_signature_handler,
)
from app.modules.form.form.handlers.get_signature import get_signature_handler

router = APIRouter(
    prefix="/centers/{center_id}/forms",
    tags=["Form - Instances"],
)


@router.post(
    "/instances",
    response_model=FormResponse,
    status_code=201,
)
async def create_instance(
    data: FormCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_INSTANCE),
            dispatch_events(),
        )
    ),
):
    return await create_instance_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        created_by=ctx.account_id,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/instances",
    response_model=FormListResponse,
)
async def list_instances(
    status: str | None = Query(None, description="상태 필터 (draft | submitted)"),
    template_id: str | None = Query(None, description="템플릿 ID 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_FORM_INSTANCE),
        )
    ),
):
    return await list_instances_handler(
        ctx.center_id, ctx.uow, status, template_id, page, size
    )


@router.get(
    "/instances/{instance_id}",
    response_model=FormResponse,
)
async def get_instance(
    instance_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_FORM_INSTANCE),
        )
    ),
):
    return await get_instance_handler(instance_id, ctx.center_id, ctx.uow)


@router.delete(
    "/instances/{instance_id}",
    status_code=204,
)
async def delete_instance(
    instance_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_FORM_INSTANCE),
            dispatch_events(),
        )
    ),
):
    await delete_instance_handler(
        event_group_id=ctx.event_group_id,
        instance_id=instance_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.put(
    "/instances/{instance_id}/answers",
    response_model=ValuesResponse,
)
async def upsert_answers(
    instance_id: str,
    data: ValuesUpsertRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_INSTANCE),
        )
    ),
):
    return await upsert_answers_handler(instance_id, ctx.center_id, data, ctx.uow)


@router.post(
    "/instances/{instance_id}/submit",
    response_model=FormResponse,
)
async def submit_instance(
    instance_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_INSTANCE),
            dispatch_events(),
        )
    ),
):
    return await submit_instance_handler(
        instance_id,
        ctx.center_id,
        ctx.uow,
        ctx.account_id,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/instances/{instance_id}/revert",
    response_model=FormResponse,
)
async def revert_instance(
    instance_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_INSTANCE),
            dispatch_events(),
        )
    ),
):
    return await revert_instance_handler(
        instance_id,
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/signatures",
    response_model=SignatureResponse,
    status_code=201,
)
async def create_signature(
    data: SignatureCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_INSTANCE),
            dispatch_events(),
        )
    ),
):
    return await create_signature_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        ip_address=ctx.ip,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/signatures/{signature_id}",
    response_model=SignatureResponse,
)
async def get_signature(
    signature_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_FORM_INSTANCE),
        )
    ),
):
    return await get_signature_handler(signature_id, ctx.center_id, ctx.uow)
