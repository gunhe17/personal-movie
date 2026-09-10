from datetime import date
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
from .handlers import (
    create_client_handler,
    update_client_handler,
    activate_client_handler,
    archive_client_handler,
    deactivate_client_handler,
    delete_client_handler,
    create_clients_handler,
    update_client_with_relations_handler,
    list_clients_by_filters_handler,
    list_with_relations_handler,
    validate_duplicate_clients_handler,
    import_clients_from_excel_handler,
)
from .schemas_excel import (
    ImportClientsFromExcelRequest,
    ImportClientsFromExcelResponse,
)
from .schemas import (
    ClientCreate,
    ClientResponse,
    ClientUpdate,
    ClientListResponse,
    CreateClientsRequest,
    CreateClientsResponse,
    UpdateClientWithRelationsRequest,
    UpdateClientWithRelationsResponse,
    ClientWithRelationsListResponse,
    ValidateDuplicateClientsRequest,
    ValidateDuplicateClientsResponse,
    AttendancePatternResponse,
    BillingSummaryResponse,
    ClientMetricsResponse,
)
from ..favorite.schemas import ClientSignalListResponse
from app.application.handlers.client import (
    get_client_metrics_handler,
    get_client_scoped_handler,
    list_clients_handler,
    get_attendance_pattern_handler,
    get_billing_summary_handler,
    get_client_signals_handler,
)

router = APIRouter(prefix="/centers/{center_id}/clients", tags=["client-profile"])


@router.get(
    "/{client_id}/attendance-pattern",
    response_model=AttendancePatternResponse,
)
async def get_client_attendance_pattern(
    client_id: str,
    last: int = Query(7, ge=1, le=30, description="최근 N회기 (기본 7, 최대 30)"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    return await get_attendance_pattern_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        last=last,
        uow=ctx.uow,
    )


@router.get(
    "/{client_id}/signals",
    response_model=ClientSignalListResponse,
    description=(
        "각 도메인 조회는 best-effort로, 일부 실패해도 나머지 신호는 반환합니다. "
        "신호는 해당 도메인 read 권한(counseling·assessment·billing) 보유 시에만 노출됩니다."
    ),
)
async def get_client_signals(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await get_client_signals_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        uow=ctx.uow,
    )


@router.get(
    "/{client_id}/billing-summary",
    response_model=BillingSummaryResponse,
)
async def get_client_billing_summary(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    return await get_billing_summary_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        uow=ctx.uow,
    )


@router.get(
    "/{client_id}/metrics",
    response_model=ClientMetricsResponse,
)
async def get_client_metrics(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await get_client_metrics_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        uow=ctx.uow,
    )


@router.post(
    "/",
    response_model=ClientResponse,
    status_code=201,
)
async def create_client(
    data: ClientCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await create_client_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/validate-duplicates",
    response_model=ValidateDuplicateClientsResponse,
)
async def validate_duplicate_clients(
    data: ValidateDuplicateClientsRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await validate_duplicate_clients_handler(ctx.center_id, data, ctx.uow)


@router.post(
    "/import-from-excel",
    response_model=ImportClientsFromExcelResponse,
    status_code=201,
)
async def import_clients_from_excel(
    data: ImportClientsFromExcelRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await import_clients_from_excel_handler(
        ctx.center_id,
        data,
        ctx.uow,
        ctx.actor_id,
        event_group_id=ctx.event_group_id,
    )


@router.post(
    "/batch",
    response_model=CreateClientsResponse,
    status_code=201,
)
async def create_clients(
    data: CreateClientsRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await create_clients_handler(
        ctx.center_id,
        data,
        ctx.uow,
        ctx.actor_id,
        event_group_id=ctx.event_group_id,
    )


@router.put(
    "/{client_id}/with-relations",
    response_model=UpdateClientWithRelationsResponse,
)
async def update_client_with_relations(
    client_id: str,
    data: UpdateClientWithRelationsRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await update_client_with_relations_handler(
        ctx.center_id,
        client_id,
        data,
        ctx.uow,
        ctx.actor_id,
        event_group_id=ctx.event_group_id,
    )


@router.get(
    "/search",
    response_model=list[ClientResponse],
)
async def list_clients_by_filters(
    name: str | None = Query(None, description="이름 (부분 일치)"),
    phone: str | None = Query(None, description="전화번호 (완전 일치)"),
    birthdate: date | None = Query(
        None, description="생년월일 (YYYY-MM-DD, 완전 일치)"
    ),
    role: str | None = Query(None, description="역할 필터 (client, guardian, both)"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await list_clients_by_filters_handler(
        ctx.center_id, name, phone, birthdate, role, ctx.uow
    )


@router.get(
    "/",
    response_model=ClientListResponse,
    description=(
        "범위: access_level=own이면 본인 담당(상담/검사 케이스 주담당+보조, 종료·탈퇴 포함) "
        "내담자만, all이면 센터 전체입니다."
    ),
)
async def list_clients(
    skip: int = Query(0, ge=0, description="건너뛸 개수"),
    limit: int = Query(100, ge=1, le=1000, description="최대 개수"),
    role: str | None = Query(None, description="역할 필터 (client, guardian, both)"),
    status: str | None = Query(
        None, description="상태 필터 (active, inactive, archived)"
    ),
    gender: str | None = Query(None, description="성별 필터 (male, female)"),
    search: str | None = Query(None, description="이름/코드/전화번호 검색"),
    sort: str | None = Query(
        None,
        description="정렬 (desc=최신순[기본], asc=오래된순, name=이름순, next_session=회기 임박순)",
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await list_clients_handler(
        ctx.center_id,
        skip,
        limit,
        role,
        status,
        gender,
        search,
        sort,
        ctx.uow,
        viewer_person_id=ctx.person_id,
        owner_scope=ctx.owner_scope,
    )


@router.get(
    "/with-relations",
    response_model=ClientWithRelationsListResponse,
)
async def list_clients_with_relations(
    skip: int = Query(0, ge=0, description="건너뛸 개수"),
    limit: int = Query(100, ge=1, le=1000, description="최대 개수"),
    role: str | None = Query(None, description="역할 필터 (client, guardian, both)"),
    status: str | None = Query(
        None, description="상태 필터 (active, inactive, archived)"
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await list_with_relations_handler(
        ctx.center_id, skip, limit, role, status, ctx.uow
    )


@router.get(
    "/{client_id}",
    response_model=ClientResponse,
)
async def get_client(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await get_client_scoped_handler(
        ctx.center_id,
        client_id,
        ctx.uow,
        viewer_person_id=ctx.person_id,
        owner_scope=ctx.owner_scope,
    )


@router.put(
    "/{client_id}",
    response_model=ClientResponse,
)
async def update_client(
    client_id: str,
    data: ClientUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await update_client_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_id=client_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{client_id}/activate",
    response_model=ClientResponse,
)
async def activate_client(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await activate_client_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_id=client_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{client_id}/deactivate",
    response_model=ClientResponse,
)
async def deactivate_client(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await deactivate_client_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_id=client_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{client_id}/archive",
    response_model=ClientResponse,
)
async def archive_client(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await archive_client_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_id=client_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{client_id}",
    status_code=200,
    response_model=ClientResponse,
)
async def delete_client(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await delete_client_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_id=client_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
