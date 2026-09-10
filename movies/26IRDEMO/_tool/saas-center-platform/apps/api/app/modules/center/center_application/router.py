from fastapi import APIRouter, Depends

from app.behavior import (
    behavior,
    AdminContext,
    UnscopedContext,
    authenticate,
    authenticate_admin,
    start_event_group,
    dispatch_events,
)
from .schemas import (
    CenterApplicationCreate,
    CenterApplicationReject,
    CenterApplicationResponse,
    CenterApplicationListResponse,
)
from app.application.handlers.center_application import (
    approve_center_application_app_handler,
)
from .handlers import (
    create_center_application_handler,
    get_center_application_handler,
    list_center_applications_handler,
    reject_center_application_handler,
    cancel_center_application_handler,
)

router = APIRouter(prefix="/centers/applications", tags=["Centers - Applications"])


def _account():
    return behavior.request_unscoped(authenticate())


def _admin():
    return behavior.request_admin(authenticate_admin())


@router.post("/", status_code=201, response_model=CenterApplicationResponse)
async def create_center_application(
    data: CenterApplicationCreate,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            authenticate(),
            dispatch_events(),
        )
    ),
):
    return await create_center_application_handler(
        data,
        ctx.account_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )


@router.get("/{application_id}", response_model=CenterApplicationResponse)
async def get_center_application(
    application_id: str,
    ctx: UnscopedContext = Depends(_account()),
):
    return await get_center_application_handler(application_id, ctx.uow)


@router.delete("/{application_id}", response_model=CenterApplicationResponse)
async def cancel_center_application(
    application_id: str,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            authenticate(),
            dispatch_events(),
        )
    ),
):
    return await cancel_center_application_handler(
        application_id,
        ctx.account_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )


@router.post("/{application_id}/approve", response_model=CenterApplicationResponse)
async def approve_center_application(
    application_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    # 심사자 = 실제 admin 신원(canonical과 동일 규약: reviewer에 admin_account_id)
    return await approve_center_application_app_handler(
        application_id,
        ctx.admin_account_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        ip=ctx.ip,
    )


@router.post("/{application_id}/reject", response_model=CenterApplicationResponse)
async def reject_center_application(
    application_id: str,
    data: CenterApplicationReject,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await reject_center_application_handler(
        application_id,
        data,
        ctx.admin_account_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        ip=ctx.ip,
    )


@router.get("/", response_model=CenterApplicationListResponse)
async def list_center_applications(
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 100,
    ctx: AdminContext = Depends(_admin()),
):
    return await list_center_applications_handler(status_filter, skip, limit, ctx.uow)
