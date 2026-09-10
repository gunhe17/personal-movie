from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends

from app.core.permissions import Permission

# Application Handler (크로스 모듈)
from app.application.handlers.assessment import (
    create_send_link_handler,
    get_send_link_delivery_history_handler,
    resend_send_link_handler,
    bulk_create_send_link_handler,
)

# Module Handler (단일 모듈)
from .handlers import list_send_links_handler
from .schemas import (
    SendLinkCreate,
    SendLinkResponse,
    SendLinkSummary,
    SendLinkResendRequest,
    BulkSendLinkCreate,
    BulkSendLinkResponse,
)
from app.modules.messaging.messaging.schemas import MessageLogSummary

router = APIRouter(prefix="/centers/{center_id}", tags=["SendLink"])


# /send-links/bulk 은 파라미터 라우트(/send-links/{id})보다 먼저 등록해야 매칭된다
@router.post(
    "/send-links/batch",
    response_model=BulkSendLinkResponse,
    status_code=201,
)
async def bulk_create_send_link(
    data: BulkSendLinkCreate,
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
    return await bulk_create_send_link_handler(
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.get(
    "/assessment-cases/{case_id}/send-links",
    response_model=list[SendLinkSummary],
)
async def list_send_links(
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
    return await list_send_links_handler(ctx.center_id, case_id, ctx.uow)


@router.post(
    "/assessment-cases/{case_id}/send-link",
    response_model=SendLinkResponse,
    status_code=201,
)
async def create_send_link(
    case_id: str,
    data: SendLinkCreate,
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
    return await create_send_link_handler(
        center_id=ctx.center_id,
        case_id=case_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.get(
    "/assessment-cases/{case_id}/send-links/{send_link_id}/delivery-history",
    response_model=list[MessageLogSummary],
)
async def get_delivery_history(
    case_id: str,
    send_link_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SEND_LINK),
        )
    ),
):
    return await get_send_link_delivery_history_handler(
        center_id=ctx.center_id,
        case_id=case_id,
        send_link_id=send_link_id,
        uow=ctx.uow,
    )


@router.post(
    "/assessment-cases/{case_id}/send-links/{send_link_id}/resend",
    response_model=SendLinkResponse,
)
async def resend_send_link(
    case_id: str,
    send_link_id: str,
    data: SendLinkResendRequest,
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
    return await resend_send_link_handler(
        center_id=ctx.center_id,
        case_id=case_id,
        send_link_id=send_link_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


# ─── 공개 라우터 — 문자 수신자(내담자) 검사 수행 경로 ───

from fastapi import Header  # noqa: E402

from app.behavior import UnscopedContext  # noqa: E402
from app.core.exceptions import UnauthorizedException  # noqa: E402
from app.infrastructure.storage import get_storage_client  # noqa: E402
from app.infrastructure.token.factory import get_token  # noqa: E402
from app.application.handlers.assessment import (  # noqa: E402
    verify_send_link_handler,
    get_link_task_handler,
    submit_link_task_handler,
)
from app.application.handlers.assessment.verify_send_link import (  # noqa: E402
    ASSESSMENT_LINK_AUDIENCE,
)
from app.modules.assessment.assessment_task.schemas import (  # noqa: E402
    TaskResponse,
    TaskSubmitData,
)
from .schemas import LinkVerifyRequest, LinkVerifyResponse  # noqa: E402

public_router = APIRouter(tags=["SendLink (Public)"])


@public_router.get("/assessment-send-links/{send_link_id}/session", response_model=LinkVerifyResponse)
async def restore_link_session(send_link_id: str, *, authorization: str | None = Header(None), ctx: UnscopedContext = Depends(behavior.request_unscoped())):
    from app.application.handlers.assessment.restore_link_session import restore_link_session_handler
    _require_link_claims(authorization, send_link_id)
    return await restore_link_session_handler(send_link_id, ctx.uow)


@public_router.get("/assessment-send-links/{send_link_id}/tasks/{task_id}/report")
async def get_link_report(send_link_id: str, task_id: str, *, authorization: str | None = Header(None), ctx: UnscopedContext = Depends(behavior.request_unscoped(start_event_group(), dispatch_events()))):
    from app.application.handlers.assessment.get_link_report import get_link_report_handler
    _require_link_claims(authorization, send_link_id)
    return await get_link_report_handler(send_link_id, task_id, ctx.uow, get_storage_client(), event_group_id=ctx.event_group_id)


def _require_link_claims(authorization: str | None, send_link_id: str) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedException("링크 인증이 필요합니다.")
    claims = get_token().decode_access_token(authorization.removeprefix("Bearer "))
    if (
        claims is None
        or claims.get("aud") != ASSESSMENT_LINK_AUDIENCE
        or claims.get("send_link_id") != send_link_id
    ):
        raise UnauthorizedException("유효하지 않은 링크 인증입니다.")


@public_router.post(
    "/assessment-send-links/{send_link_id}/verify",
    response_model=LinkVerifyResponse,
)
async def verify_send_link(
    send_link_id: str,
    data: LinkVerifyRequest,
    *,
    ctx: UnscopedContext = Depends(behavior.request_unscoped()),
):
    return await verify_send_link_handler(
        send_link_id=send_link_id,
        verification_code=data.verification_code,
        uow=ctx.uow,
    )


@public_router.get(
    "/assessment-send-links/{send_link_id}/tasks/{task_id}",
    response_model=TaskResponse,
)
async def get_link_task(
    send_link_id: str,
    task_id: str,
    *,
    authorization: str | None = Header(None),
    ctx: UnscopedContext = Depends(behavior.request_unscoped()),
):
    _require_link_claims(authorization, send_link_id)
    return await get_link_task_handler(
        send_link_id=send_link_id,
        task_id=task_id,
        uow=ctx.uow,
    )


@public_router.post(
    "/assessment-send-links/{send_link_id}/tasks/{task_id}/submit",
    response_model=TaskResponse,
)
async def submit_link_task(
    send_link_id: str,
    task_id: str,
    data: TaskSubmitData,
    *,
    authorization: str | None = Header(None),
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    _require_link_claims(authorization, send_link_id)
    return await submit_link_task_handler(
        send_link_id=send_link_id,
        task_id=task_id,
        data=data,
        storage=get_storage_client(),
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
    )
