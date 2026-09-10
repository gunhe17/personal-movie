from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse


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
from app.modules.voucher.center_voucher.handlers.create_center_voucher import (
    create_center_voucher_handler,
)
from app.modules.voucher.center_voucher.handlers.delete_center_voucher import (
    delete_center_voucher_handler,
)
from app.modules.voucher.center_voucher.handlers.get_center_voucher import (
    get_center_voucher_handler,
)
from app.application.handlers.voucher.get_voucher_clients import (
    get_voucher_clients_handler,
)
from app.application.handlers.voucher.get_voucher_document_file import (
    get_voucher_document_file_handler,
)
from app.application.handlers.voucher.get_voucher_documents import (
    get_voucher_documents_handler,
)
from app.modules.voucher.center_voucher.handlers.get_voucher_stats import (
    get_voucher_stats_handler,
)
from app.modules.voucher.center_voucher.handlers.list_center_vouchers import (
    list_center_vouchers_handler,
)
from app.modules.voucher.center_voucher.handlers.list_voucher_catalog import (
    list_voucher_catalog_handler,
)
from app.modules.voucher.center_voucher.handlers.update_center_voucher import (
    update_center_voucher_handler,
)
from app.modules.voucher.center_voucher.schemas import (
    CenterVoucherClientsResponse,
    CenterVoucherCreate,
    CenterVoucherDeleteResponse,
    CenterVoucherDocumentsResponse,
    CenterVoucherListResponse,
    CenterVoucherResponse,
    CenterVoucherStatsResponse,
    CenterVoucherUpdate,
    VoucherCatalogListResponse,
)

router = APIRouter(
    prefix="/centers/{center_id}",
    tags=["Voucher - CenterVoucher"],
)


@router.get(
    "/voucher-catalog",
    response_model=VoucherCatalogListResponse,
)
async def list_voucher_catalog(
    q: str | None = Query(None, description="검색어 (사업명·기관)"),
    year: int | None = Query(None, description="사업 연도"),
    organization: str | None = Query(None, description="사업 기관"),
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
    return await list_voucher_catalog_handler(
        ctx.center_id, q, year, organization, page, size, ctx.uow
    )


@router.post(
    "/center-vouchers",
    response_model=CenterVoucherResponse,
    status_code=201,
)
async def create_center_voucher(
    data: CenterVoucherCreate,
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
    return await create_center_voucher_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/center-vouchers",
    response_model=CenterVoucherListResponse,
)
async def list_center_vouchers(
    is_active: bool | None = Query(None, description="활성 여부 필터"),
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
    return await list_center_vouchers_handler(
        ctx.center_id, is_active, page, size, ctx.uow
    )


@router.get(
    "/center-vouchers/stats",
    response_model=CenterVoucherStatsResponse,
)
async def get_voucher_stats(
    expiring_window_days: int = Query(
        60, ge=1, le=365, description="만료 임박 기준 일수"
    ),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_VOUCHER),
        )
    ),
):
    return await get_voucher_stats_handler(ctx.center_id, expiring_window_days, ctx.uow)


@router.get(
    "/center-vouchers/{center_voucher_id}",
    response_model=CenterVoucherResponse,
)
async def get_center_voucher(
    center_voucher_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_VOUCHER),
        )
    ),
):
    return await get_center_voucher_handler(ctx.center_id, center_voucher_id, ctx.uow)


@router.patch(
    "/center-vouchers/{center_voucher_id}",
    response_model=CenterVoucherResponse,
)
async def update_center_voucher(
    center_voucher_id: str,
    data: CenterVoucherUpdate,
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
    return await update_center_voucher_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        center_voucher_id=center_voucher_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/center-vouchers/{center_voucher_id}",
    response_model=CenterVoucherDeleteResponse,
    status_code=200,
)
async def delete_center_voucher(
    center_voucher_id: str,
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
    return await delete_center_voucher_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        center_voucher_id=center_voucher_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/center-vouchers/{center_voucher_id}/documents",
    response_model=CenterVoucherDocumentsResponse,
)
async def get_voucher_documents(
    center_voucher_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_VOUCHER),
        )
    ),
):
    return await get_voucher_documents_handler(
        ctx.center_id, center_voucher_id, ctx.uow
    )


@router.get(
    "/center-vouchers/{center_voucher_id}/clients",
    response_model=CenterVoucherClientsResponse,
    description="잔여 회기 > 0 인(사용중) 내담자만 반환합니다.",
)
async def get_voucher_clients(
    center_voucher_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_VOUCHER),
        )
    ),
):
    return await get_voucher_clients_handler(ctx.center_id, center_voucher_id, ctx.uow)


@router.get(
    "/center-vouchers/{center_voucher_id}/documents/{global_document_id}/file",
    response_class=StreamingResponse,
    description="원본 파일만 스트리밍하며, 내부 산출물(가공 markdown)은 제공하지 않습니다.",
)
async def get_voucher_document_file(
    center_voucher_id: str,
    global_document_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_VOUCHER),
        )
    ),
):
    return await get_voucher_document_file_handler(
        ctx.center_id, center_voucher_id, global_document_id, ctx.uow
    )
