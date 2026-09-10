from app.behavior import (
    behavior,
    ServerContext,
    UnscopedContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.core.permissions import Permission
from app.infrastructure.storage import get_storage_client

# Application Handler (크로스 모듈)
from app.application.handlers.assessment import (
    create_send_result_handler,
    get_send_result_delivery_history_handler,
    resend_send_result_handler,
    list_transmission_history_handler,
)
from app.application.handlers.assessment.verify_send_result import (
    verify_send_result_handler,
)

# Module Handler (단일 모듈)
from .handlers import list_send_results_handler
from .schemas import (
    SendResultCreate,
    SendResultResponse,
    SendResultSummary,
    SendResultResendRequest,
    VerifyRequest,
    VerifyResponse,
)
from app.application.schemas import TransmissionListResponse
from app.modules.messaging.messaging.schemas import MessageLogSummary

# 센터 라우터 (인증 필요)
router = APIRouter(prefix="/centers/{center_id}", tags=["SendResult"])

# 공개 라우터 (인증 불필요)
public_router = APIRouter(tags=["SendResult (Public)"])


@router.get(
    "/assessment-cases/{case_id}/send-results",
    response_model=list[SendResultSummary],
)
async def list_send_results(
    case_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SEND_LINK),
        )
    ),
):
    return await list_send_results_handler(ctx.center_id, case_id, ctx.uow)


@router.get("/assessment-transmissions", response_model=TransmissionListResponse)
async def list_transmission_history(
    center_id: str,
    type: str = Query("test-result", description="direct-link | test-result"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SEND_LINK),
        )
    ),
):
    return await list_transmission_history_handler(
        center_id=ctx.center_id, transmission_type=type, page=page, size=size, uow=ctx.uow
    )


@router.post(
    "/assessment-cases/{case_id}/send-result",
    response_model=SendResultResponse,
    status_code=201,
)
async def create_send_result(
    case_id: str,
    data: SendResultCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_SEND_LINK),
            dispatch_events(),
        )
    ),
):
    return await create_send_result_handler(
        center_id=ctx.center_id,
        case_id=case_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.get(
    "/assessment-cases/{case_id}/send-results/{send_result_id}/delivery-history",
    response_model=list[MessageLogSummary],
)
async def get_delivery_history(
    case_id: str,
    send_result_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SEND_LINK),
        )
    ),
):
    return await get_send_result_delivery_history_handler(
        center_id=ctx.center_id,
        case_id=case_id,
        send_result_id=send_result_id,
        uow=ctx.uow,
    )


@router.post(
    "/assessment-cases/{case_id}/send-results/{send_result_id}/resend",
    response_model=SendResultResponse,
)
async def resend_send_result(
    case_id: str,
    send_result_id: str,
    data: SendResultResendRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_SEND_LINK),
            dispatch_events(),
        )
    ),
):
    return await resend_send_result_handler(
        center_id=ctx.center_id,
        case_id=case_id,
        send_result_id=send_result_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@public_router.post(
    "/assessment-results/{send_result_id}/verify",
    response_model=VerifyResponse,
)
async def verify_send_result(
    send_result_id: str,
    data: VerifyRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await verify_send_result_handler(
        send_result_id=send_result_id,
        verification_code=data.verification_code,
        uow=ctx.uow,
        storage=get_storage_client(),
        event_group_id=ctx.event_group_id,
    )
