from fastapi import APIRouter, Request, Query, Depends
from fastapi.responses import StreamingResponse
from app.behavior import (
    behavior,
    ServerContext,
    UnscopedContext,
    authenticate,
    require_membership,
    start_event_group,
    dispatch_events,
)
from app.infrastructure.storage import get_storage_client
from .handlers import (
    create_share_token_handler,
    validate_share_token_handler,
    download_with_share_token_handler,
    get_download_url_with_share_token_handler,
    list_share_tokens_handler,
)
from .schemas import (
    ShareTokenResponse,
    ShareTokenCreate,
    ShareTokenValidate,
    ShareTokenValidateResponse,
    ShareTokenListResponse,
    ShareTokenDownloadUrlResponse,
)

router = APIRouter(prefix="/document/share/share", tags=["document-share"])


@router.post(
    "/",
    response_model=ShareTokenResponse,
    status_code=201,
)
async def create_share_token(
    data: ShareTokenCreate,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await create_share_token_handler(
        event_group_id=ctx.event_group_id,
        data=data,
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        account_id=ctx.account_id,
        uow=ctx.uow,
    )


# 토큰 기반 공개 접근(검증·다운로드) — 센터 인증 없음. 토큰은 핸들러가 검증.
@router.post(
    "/validate",
    response_model=ShareTokenValidateResponse,
)
async def validate_share_token(
    data: ShareTokenValidate,
    ctx: UnscopedContext = Depends(behavior.request_unscoped()),
):
    return await validate_share_token_handler(data=data, uow=ctx.uow)


@router.get(
    "/download",
    response_class=StreamingResponse,
)
async def download_with_share_token(
    token: str = Query(..., description="공유 토큰"),
    password: str | None = Query(None, description="비밀번호 (설정된 경우)"),
    request: Request = None,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await download_with_share_token_handler(
        token=token,
        password=password,
        request=request,
        storage=get_storage_client(),
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
    )


@router.get(
    "/download-url",
    response_model=ShareTokenDownloadUrlResponse,
)
async def get_download_url_with_share_token(
    token: str = Query(..., description="공유 토큰"),
    password: str | None = Query(None, description="비밀번호 (설정된 경우)"),
    expires_in: int = Query(3600, description="URL 유효 시간 (초)", ge=60, le=604800),
    request: Request = None,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await get_download_url_with_share_token_handler(
        token=token,
        password=password,
        expires_in=expires_in,
        request=request,
        storage=get_storage_client(),
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
    )


@router.get(
    "/documents/{document_id}",
    response_model=ShareTokenListResponse,
)
async def list_share_tokens(
    document_id: str,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_share_tokens_handler(
        document_id=document_id,
        center_id=ctx.center_id,
        page=page,
        size=size,
        uow=ctx.uow,
    )
