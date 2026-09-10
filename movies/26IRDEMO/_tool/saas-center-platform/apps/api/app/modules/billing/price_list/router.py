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
from app.modules.billing.price_list.handlers import (
    create_price_list_handler,
    delete_price_list_handler,
    find_price_lists_by_references_handler,
    get_price_list_handler,
    list_price_lists_handler,
    update_price_list_handler,
)
from app.modules.billing.price_list.schemas import (
    PriceListCreate,
    PriceListDeleteResponse,
    PriceListListResponse,
    PriceListResponse,
    PriceListUpdate,
    ServiceType,
)

router = APIRouter(
    prefix="/centers/{center_id}/price-lists",
    tags=["Billing - PriceList"],
)


@router.post(
    "/",
    response_model=PriceListResponse,
    status_code=201,
)
async def create_price_list(
    data: PriceListCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_BILLING),
            dispatch_events(),
        )
    ),
):
    return await create_price_list_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/",
    response_model=PriceListListResponse,
)
async def list_price_lists(
    service_type: ServiceType | None = Query(None, description="서비스 유형 필터"),
    is_active: bool | None = Query(None, description="활성 여부 필터"),
    search: str | None = Query(None, description="서비스명 검색"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(50, ge=1, le=200, description="페이지 크기"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    return await list_price_lists_handler(
        center_id=ctx.center_id,
        uow=ctx.uow,
        service_type=service_type,
        is_active=is_active,
        search=search,
        page=page,
        size=size,
    )


@router.get(
    "/by-references",
    response_model=list[PriceListResponse],
)
async def find_price_lists_by_references(
    reference_ids: list[str] = Query(..., description="연관 리소스 ID 목록"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    return await find_price_lists_by_references_handler(
        center_id=ctx.center_id,
        reference_ids=reference_ids,
        uow=ctx.uow,
    )


@router.get(
    "/{price_list_id}",
    response_model=PriceListResponse,
)
async def get_price_list(
    price_list_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    return await get_price_list_handler(ctx.center_id, price_list_id, ctx.uow)


@router.patch(
    "/{price_list_id}",
    response_model=PriceListResponse,
)
async def update_price_list(
    price_list_id: str,
    data: PriceListUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_BILLING),
            dispatch_events(),
        )
    ),
):
    return await update_price_list_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        price_list_id=price_list_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{price_list_id}",
    response_model=PriceListDeleteResponse,
    status_code=200,
)
async def delete_price_list(
    price_list_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_BILLING),
            dispatch_events(),
        )
    ),
):
    return await delete_price_list_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        price_list_id=price_list_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
