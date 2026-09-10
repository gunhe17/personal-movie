from fastapi import APIRouter, Depends, Query

from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from app.core.permissions import Permission
from datetime import date

from app.application.handlers.voucher import (
    create_client_voucher_handler,
    get_voucher_usage_handler,
    get_voucher_usage_monthly_handler,
    link_voucher_form_instance_handler,
    list_voucher_clients_handler,
    list_voucher_forms_handler,
    unlink_voucher_form_instance_handler,
)
from app.application.schemas import (
    ClientFormInstanceItem,
    ClientFormInstanceListResponse,
    VoucherClientListResponse,
)
from app.modules.voucher.client_voucher_resource.schemas import (
    VoucherFormInstanceCreate,
)
from app.modules.voucher.client_voucher.handlers.delete_client_voucher import (
    delete_client_voucher_handler,
)
from app.modules.voucher.client_voucher.handlers.get_client_voucher import (
    get_client_voucher_handler,
)
from app.modules.voucher.client_voucher.handlers.list_client_vouchers import (
    list_client_vouchers_handler,
)
from app.modules.voucher.client_voucher.handlers.update_client_voucher import (
    update_client_voucher_handler,
)
from app.modules.voucher.client_voucher.schemas import (
    ClientVoucherCreate,
    ClientVoucherDeleteResponse,
    ClientVoucherListResponse,
    ClientVoucherResponse,
    ClientVoucherUpdate,
    VoucherMonthlyUsageResponse,
    VoucherUsageResponse,
)

router = APIRouter(
    prefix="/centers/{center_id}",
    tags=["Voucher - ClientVoucher"],
)


@router.post(
    "/client-vouchers",
    response_model=ClientVoucherResponse,
    status_code=201,
)
async def create_client_voucher(
    data: ClientVoucherCreate,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_VOUCHER),
            dispatch_events(),
        )
    ),
):
    return await create_client_voucher_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/client-vouchers",
    response_model=ClientVoucherListResponse,
)
async def list_client_vouchers(
    client_id: str | None = Query(None, description="내담자 ID 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(50, ge=1, le=200, description="페이지 크기"),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_VOUCHER),
        )
    ),
):
    return await list_client_vouchers_handler(
        ctx.center_id, client_id, page, size, ctx.uow
    )


@router.get(
    "/voucher-clients",
    response_model=VoucherClientListResponse,
)
async def list_voucher_clients(
    status: str | None = Query(None, description="상태 필터 (active | completed)"),
    search: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    sort: str | None = Query(None),
    signal: str | None = Query(None, description="시그널 필터 (low | expiring)"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_VOUCHER),
        )
    ),
):
    return await list_voucher_clients_handler(
        center_id=ctx.center_id,
        skip=(page - 1) * size,
        limit=size,
        status_filter=status,
        search=search,
        date_from=date_from,
        date_to=date_to,
        sort=sort,
        uow=ctx.uow,
        signal=signal,
    )


@router.get(
    "/client-vouchers/{client_voucher_id}",
    response_model=ClientVoucherResponse,
)
async def get_client_voucher(
    client_voucher_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_VOUCHER),
        )
    ),
):
    return await get_client_voucher_handler(ctx.center_id, client_voucher_id, ctx.uow)


@router.patch(
    "/client-vouchers/{client_voucher_id}",
    response_model=ClientVoucherResponse,
)
async def update_client_voucher(
    client_voucher_id: str,
    data: ClientVoucherUpdate,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_VOUCHER),
            dispatch_events(),
        )
    ),
):
    return await update_client_voucher_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_voucher_id=client_voucher_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/client-vouchers/{client_voucher_id}",
    response_model=ClientVoucherDeleteResponse,
    status_code=200,
)
async def delete_client_voucher(
    client_voucher_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_VOUCHER),
            dispatch_events(),
        )
    ),
):
    return await delete_client_voucher_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_voucher_id=client_voucher_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/client-vouchers/{client_voucher_id}/usage",
    response_model=VoucherUsageResponse,
)
async def get_voucher_usage(
    client_voucher_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_VOUCHER),
        )
    ),
):
    return await get_voucher_usage_handler(ctx.center_id, client_voucher_id, ctx.uow)


@router.get(
    "/client-vouchers/{client_voucher_id}/usage/monthly",
    response_model=VoucherMonthlyUsageResponse,
)
async def get_voucher_usage_monthly(
    client_voucher_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_VOUCHER),
        )
    ),
):
    return await get_voucher_usage_monthly_handler(
        ctx.center_id, client_voucher_id, ctx.uow
    )


# Form Instance 매핑 엔드포인트 (크로스 모듈)


@router.post(
    "/client-vouchers/{client_voucher_id}/form-instances",
    response_model=ClientFormInstanceItem,
    status_code=201,
)
async def link_voucher_form_instance(
    client_voucher_id: str,
    data: VoucherFormInstanceCreate,
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
    return await link_voucher_form_instance_handler(
        center_id=ctx.center_id,
        client_voucher_id=client_voucher_id,
        template_id=data.template_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/client-vouchers/{client_voucher_id}/form-instances",
    response_model=ClientFormInstanceListResponse,
)
async def list_voucher_form_instances(
    client_voucher_id: str,
    status: str | None = Query(None, description="상태 필터 (draft | submitted)"),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_FORM_INSTANCE),
        )
    ),
):
    return await list_voucher_forms_handler(
        center_id=ctx.center_id,
        client_voucher_id=client_voucher_id,
        uow=ctx.uow,
        status=status,
    )


@router.delete(
    "/client-vouchers/{client_voucher_id}/form-instances/{mapping_id}",
    status_code=204,
    description="바우처 매핑만 해제하며, 폼 인스턴스와 내담자 연결은 유지됩니다.",
)
async def unlink_voucher_form_instance(
    client_voucher_id: str,
    mapping_id: str,
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
    await unlink_voucher_form_instance_handler(
        center_id=ctx.center_id,
        mapping_id=mapping_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )
