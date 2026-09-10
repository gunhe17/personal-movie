"""Person Credential 모듈 - Router (본인용)

엔드포인트:
- GET    /persons/me/credentials              본인 credentials 목록
- POST   /persons/me/credentials              신규 등록
- PATCH  /persons/me/credentials/{id}         수정 (verification 자동 리셋)
- DELETE /persons/me/credentials/{id}         Soft Delete
- POST   /persons/me/credentials/{id}/request-verification  검증 요청

어드민 라우트는 platform_admin 모듈에 별도 구성.
"""

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import StreamingResponse

from app.behavior import (
    behavior,
    UnscopedContext,
    authenticate,
    start_event_group,
    dispatch_events,
)
from app.infrastructure.storage import get_storage_client

from .handlers import (
    create_credential_handler,
    delete_attachment_handler,
    delete_credential_handler,
    download_attachment_handler,
    list_credentials_handler,
    request_verification_handler,
    update_credential_handler,
    upload_credential_attachment_handler,
)
from .models import CredentialType
from .presigned import attach_presigned_url, attach_presigned_urls
from .schemas import (
    CredentialCreate,
    CredentialListResponse,
    CredentialResponse,
    CredentialUpdate,
)

router = APIRouter(prefix="/persons/me/credentials", tags=["person-credential"])


@router.get(
    "",
    response_model=CredentialListResponse,
)
async def list_my_credentials(
    credential_type: CredentialType | None = None,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
        )
    ),
):
    result = await list_credentials_handler(ctx.person_id, ctx.uow, credential_type=credential_type)
    await attach_presigned_urls(result.items)
    return result


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=CredentialResponse,
)
async def create_my_credential(
    data: CredentialCreate,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    result = await create_credential_handler(
        ctx.person_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )
    return await attach_presigned_url(result)


@router.patch(
    "/{credential_id}",
    response_model=CredentialResponse,
)
async def update_my_credential(
    credential_id: str,
    data: CredentialUpdate,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    result = await update_credential_handler(
        credential_id,
        ctx.person_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )
    return await attach_presigned_url(result)


@router.delete(
    "/{credential_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_my_credential(
    credential_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    await delete_credential_handler(
        credential_id,
        ctx.person_id,
        get_storage_client(),
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )


@router.post(
    "/{credential_id}/request-verification",
    response_model=CredentialResponse,
)
async def request_verification(
    credential_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    result = await request_verification_handler(
        credential_id,
        ctx.person_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )
    return await attach_presigned_url(result)


@router.post(
    "/{credential_id}/attachment",
    response_model=CredentialResponse,
)
async def upload_attachment(
    credential_id: str,
    file: UploadFile = File(...),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    result = await upload_credential_attachment_handler(
        credential_id,
        ctx.person_id,
        file,
        get_storage_client(),
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )
    return await attach_presigned_url(result)


@router.delete(
    "/{credential_id}/attachment",
    response_model=CredentialResponse,
)
async def delete_attachment(
    credential_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    result = await delete_attachment_handler(
        credential_id,
        ctx.person_id,
        get_storage_client(),
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )
    return await attach_presigned_url(result)


@router.get(
    "/{credential_id}/attachment/download",
    response_class=StreamingResponse,
)
async def download_attachment(
    credential_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
        )
    ),
):
    return await download_attachment_handler(
        credential_id, ctx.person_id, get_storage_client(), ctx.uow
    )
