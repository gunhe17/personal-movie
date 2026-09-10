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
from app.application.handlers.billing import (
    create_billable_handler,
    build_billable_prefill_for_case_handler,
    list_billable_targets_by_client_handler,
    list_missing_billables_until_today_handler,
    list_billables_handler,
    get_billable_handler,
    update_billable_handler,
    complete_billable_handler,
    list_billables_by_related_handler,
)
from app.application.schemas import BillableTarget, BillableTargetListResponse
from app.modules.billing.billable.schemas import (
    BillableCreate,
    BillableUpdate,
    BillableListResponse,
    BillablePrefillItem,
    BillableSummary,
    BillableResponse,
    BillableStatus,
)

router = APIRouter(
    prefix="/centers/{center_id}/billables",
    tags=["Billing - Billable"],
)


@router.post(
    "/",
    response_model=BillableResponse,
    status_code=201,
)
async def create_billable(
    data: BillableCreate,
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
    return await create_billable_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/",
    response_model=BillableListResponse,
)
async def list_billables(
    status: BillableStatus | None = Query(None, description="상태 필터"),
    client_id: str | None = Query(None, description="내담자 ID 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    sort: str = Query(
        "desc", pattern="^(asc|desc)$", description="생성일 정렬 (asc | desc)"
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    return await list_billables_handler(
        center_id=ctx.center_id,
        uow=ctx.uow,
        status=status.value if status else None,
        client_id=client_id,
        page=page,
        size=size,
        sort=sort,
    )


@router.get(
    "/by-related",
    response_model=list[BillableSummary],
)
async def list_billables_by_related(
    related_type: str = Query(
        ...,
        description="연관 유형 (쉼표로 여러 개): counseling_session, counseling_case, assessment_session, assessment_case",
    ),
    related_case_id: str | None = Query(None, description="연관 케이스 ID"),
    related_session_id: str | None = Query(
        None, description="연관 세션 ID (지정 시 세션 단위로 조회)"
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    types = [t.strip() for t in related_type.split(",") if t.strip()]
    return await list_billables_by_related_handler(
        center_id=ctx.center_id,
        related_type=types if len(types) > 1 else (types[0] if types else related_type),
        related_case_id=related_case_id,
        related_session_id=related_session_id,
        uow=ctx.uow,
    )


@router.get(
    "/billable-targets/by-client/{client_id}",
    response_model=BillableTargetListResponse,
)
async def list_billable_targets_by_client(
    client_id: str,
    type: str | None = Query(
        None,
        description="타입 필터: 'assessment' | 'counseling' (없으면 전체)",
        pattern="^(assessment|counseling)$",
    ),
    include_billed: bool = Query(False, description="이미 청구된 세션도 포함 여부"),
    page: int = Query(1, ge=1, description="페이지 번호 (1-based)"),
    size: int = Query(10, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    return await list_billable_targets_by_client_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        type_filter=type,
        include_billed=include_billed,
        page=page,
        size=size,
        uow=ctx.uow,
    )


@router.get(
    "/today-missing",
    response_model=list[BillableTarget],
    description="세션 단위 청구가 없고 케이스 패키지 선결제로도 커버되지 않은 미청구 세션을 반환합니다.",
)
async def list_today_missing_billables(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    return await list_missing_billables_until_today_handler(
        center_id=ctx.center_id,
        uow=ctx.uow,
    )


@router.get(
    "/prefill",
    response_model=list[BillablePrefillItem],
    description="단가표 미매칭 항목은 unit_price=0 / price_list_id=null 로 반환됩니다.",
)
async def get_billable_prefill(
    case_type: str = Query(..., description="counseling | assessment"),
    case_id: str = Query(..., description="케이스 ID"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    return await build_billable_prefill_for_case_handler(
        center_id=ctx.center_id,
        case_type=case_type,
        case_id=case_id,
        uow=ctx.uow,
    )


@router.get(
    "/{billable_id}",
    response_model=BillableResponse,
)
async def get_billable(
    billable_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    return await get_billable_handler(ctx.center_id, billable_id, ctx.uow)


@router.patch(
    "/{billable_id}",
    response_model=BillableResponse,
)
async def update_billable(
    billable_id: str,
    data: BillableUpdate,
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
    return await update_billable_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        billable_id=billable_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{billable_id}/complete",
    response_model=BillableResponse,
)
async def complete_billable(
    billable_id: str,
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
    return await complete_billable_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        billable_id=billable_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
