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
from app.application.handlers.form import (
    create_form_send_handler,
    resend_form_send_handler,
    list_form_sends_enriched_handler,
)

from .schemas import (
    FormSendCreate,
    FormSendResponse,
    FormSendSummary,
    FormSendResendRequest,
)

router = APIRouter(
    prefix="/centers/{center_id}/forms",
    tags=["FormSend"],
)


@router.get(
    "/templates/{template_id}/sends",
    response_model=list[FormSendSummary],
)
async def list_form_sends(
    template_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_FORM_INSTANCE),
        )
    ),
):
    return await list_form_sends_enriched_handler(ctx.center_id, template_id, ctx.uow)


@router.post(
    "/templates/{template_id}/send",
    response_model=FormSendResponse,
    status_code=201,
)
async def create_form_send(
    template_id: str,
    data: FormSendCreate,
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
    return await create_form_send_handler(
        center_id=ctx.center_id,
        template_id=template_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/sends/{send_id}/resend",
    response_model=FormSendResponse,
)
async def resend_form_send(
    send_id: str,
    data: FormSendResendRequest,
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
    return await resend_form_send_handler(
        center_id=ctx.center_id,
        send_id=send_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


# 원격 작성 링크 — 보호자용 공개 표면(인증 불필요, 코드/토큰으로 스코프)

from fastapi import Header, Query  # noqa: E402
from fastapi.responses import StreamingResponse  # noqa: E402

from app.behavior import UnscopedContext  # noqa: E402
from app.core.exceptions import UnauthorizedException  # noqa: E402
from app.infrastructure.token.factory import get_token  # noqa: E402
from app.application.handlers.form.verify_form_link import (  # noqa: E402
    verify_form_link_handler,
    FORM_LINK_AUDIENCE,
)
from app.application.handlers.form.submit_form_link import (  # noqa: E402
    submit_form_link_handler,
)
from app.application.handlers.form.get_form_link_page_image import (  # noqa: E402
    get_form_link_page_image_handler,
)
from .schemas import (  # noqa: E402
    FormLinkVerifyRequest,
    FormLinkVerifyResponse,
    FormLinkSubmitRequest,
)

public_router = APIRouter(tags=["FormLink (Public)"])


def _require_form_link_claims(token: str, instance_id: str) -> str:
    claims = get_token().decode_access_token(token)
    if (
        claims is None
        or claims.get("aud") != FORM_LINK_AUDIENCE
        or claims.get("instance_id") != instance_id
    ):
        raise UnauthorizedException("유효하지 않은 링크 인증입니다.")
    return claims["center_id"]


@public_router.post(
    "/form-links/{instance_id}/verify",
    response_model=FormLinkVerifyResponse,
)
async def verify_form_link(
    instance_id: str,
    data: FormLinkVerifyRequest,
    *,
    ctx: UnscopedContext = Depends(behavior.request_unscoped()),
):
    return await verify_form_link_handler(
        instance_id=instance_id,
        verification_code=data.verification_code,
        uow=ctx.uow,
    )


@public_router.post("/form-links/{instance_id}/submit")
async def submit_form_link(
    instance_id: str,
    data: FormLinkSubmitRequest,
    *,
    authorization: str | None = Header(None),
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(start_event_group(), dispatch_events())
    ),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedException("링크 인증이 필요합니다.")
    center_id = _require_form_link_claims(
        authorization.removeprefix("Bearer "), instance_id
    )
    return await submit_form_link_handler(
        instance_id=instance_id,
        center_id=center_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
    )


@public_router.get("/form-links/{instance_id}/pages/{page_no}/image")
async def get_form_link_page_image(
    instance_id: str,
    page_no: int,
    t: str = Query(...),
    *,
    ctx: UnscopedContext = Depends(behavior.request_unscoped()),
) -> StreamingResponse:
    center_id = _require_form_link_claims(t, instance_id)
    return await get_form_link_page_image_handler(
        instance_id=instance_id,
        center_id=center_id,
        page_no=page_no,
        uow=ctx.uow,
    )
