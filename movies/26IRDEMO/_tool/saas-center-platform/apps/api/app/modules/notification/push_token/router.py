from fastapi import APIRouter, Depends, Query, Response

from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
)
from .schemas import PushTokenRegister, PushTokenResponse
from .handlers import register_push_token_handler, unregister_push_token_handler

router = APIRouter(
    prefix="/centers/{center_id}/notifications/push-tokens",
    tags=["Push Tokens"],
)


@router.post(
    "",
    response_model=PushTokenResponse,
    status_code=201,
)
async def register_push_token(
    data: PushTokenRegister,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await register_push_token_handler(
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        data=data,
        uow=ctx.uow,
    )


async def _unregister(token: str, ctx: ServerContext) -> Response:
    # DELETE는 idempotent — 토큰이 없거나 이미 비활성이어도 204.
    # 로그인 실패 후 로그아웃, 센터 전환 등에서 불필요한 에러 로그를 방지.
    await unregister_push_token_handler(
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        token=token,
        uow=ctx.uow,
    )
    return Response(status_code=204)


@router.delete(
    "",
    status_code=204,
    description=(
        "iOS Expo 토큰(`ExponentPushToken[...]`)처럼 URL path에 부적합한 "
        "문자를 포함할 수 있는 토큰을 안전하게 전달하기 위한 경로."
    ),
)
async def unregister_push_token_by_query(
    token: str = Query(..., description="FCM/Expo 푸시 토큰"),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await _unregister(token=token, ctx=ctx)


@router.delete(
    "/{token}",
    status_code=204,
    description=(
        "기존 웹/구버전 모바일 클라이언트 호환용. 신규 클라이언트는 "
        "쿼리 파라미터 경로(`DELETE /push-tokens?token=...`)를 사용할 것."
    ),
)
async def unregister_push_token(
    token: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await _unregister(token=token, ctx=ctx)
