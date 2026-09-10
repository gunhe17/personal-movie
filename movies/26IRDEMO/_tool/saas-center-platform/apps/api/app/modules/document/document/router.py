from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, UploadFile, File, Form, Query, Depends
from fastapi.responses import StreamingResponse
from app.core.permissions import Permission
from app.infrastructure.storage import get_storage_client
from .handlers import (
    upload_document_handler,
    download_document_handler,
    get_download_url_handler,
    list_documents_handler,
    get_document_handler,
    update_document_handler,
    delete_document_handler,
    restore_document_handler,
)
from .schemas import DocumentResponse, DocumentUpdate, DocumentListResponse, DownloadUrlResponse

router = APIRouter(prefix="/centers/{center_id}/documents", tags=["document"])


@router.post(
    "/",
    response_model=DocumentResponse,
    status_code=201,
)
async def upload_document(
    file: UploadFile = File(..., description="업로드할 파일"),
    name: str | None = Form(None, description="문서 표시명 (미입력 시 파일명 사용)"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_DOCUMENT),
            dispatch_events(),
        )
    ),
):
    return await upload_document_handler(
        center_id=ctx.center_id,
        uploader_id=ctx.actor_id,
        account_id=ctx.account_id,
        file=file,
        name=name,
        ip_address=ctx.ip,
        user_agent=ctx.user_agent,
        storage=get_storage_client(),
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
    )


@router.get(
    "/",
    response_model=DocumentListResponse,
)
async def list_documents(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    include_deleted: bool = Query(False, description="삭제된 문서 포함 여부"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_DOCUMENT),
        )
    ),
):
    return await list_documents_handler(
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        page=page,
        size=size,
        include_deleted=include_deleted,
        uow=ctx.uow,
    )


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
)
async def get_document(
    document_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_DOCUMENT),
        )
    ),
):
    return await get_document_handler(
        document_id=document_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
    )


@router.put(
    "/{document_id}",
    response_model=DocumentResponse,
)
async def update_document(
    document_id: str,
    data: DocumentUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_DOCUMENT),
            dispatch_events(),
        )
    ),
):
    return await update_document_handler(
        event_group_id=ctx.event_group_id,
        document_id=document_id,
        data=data,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        ip_address=ctx.ip,
        user_agent=ctx.user_agent,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/{document_id}/download",
    response_class=StreamingResponse,
)
async def download_document(
    document_id: str,
    version_id: str | None = Query(None, description="특정 버전 ID"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_DOCUMENT),
        )
    ),
):
    return await download_document_handler(
        document_id=document_id,
        version_id=version_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        ip_address=ctx.ip,
        user_agent=ctx.user_agent,
        storage=get_storage_client(),
        uow=ctx.uow,
    )


@router.get(
    "/{document_id}/download-url",
    response_model=DownloadUrlResponse,
)
async def get_document_download_url(
    document_id: str,
    version_id: str | None = Query(None, description="특정 버전 ID"),
    expires_in: int = Query(3600, description="URL 유효 시간 (초)", ge=60, le=604800),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_DOCUMENT),
        )
    ),
):
    return await get_download_url_handler(
        document_id=document_id,
        version_id=version_id,
        expires_in=expires_in,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        ip_address=ctx.ip,
        user_agent=ctx.user_agent,
        storage=get_storage_client(),
        uow=ctx.uow,
    )


@router.delete(
    "/{document_id}",
    response_model=DocumentResponse,
)
async def delete_document(
    document_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_DOCUMENT),
            dispatch_events(),
        )
    ),
):
    return await delete_document_handler(
        event_group_id=ctx.event_group_id,
        document_id=document_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        ip_address=ctx.ip,
        user_agent=ctx.user_agent,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{document_id}/restore",
    response_model=DocumentResponse,
)
async def restore_document(
    document_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_DOCUMENT),
            dispatch_events(),
        )
    ),
):
    return await restore_document_handler(
        event_group_id=ctx.event_group_id,
        document_id=document_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        ip_address=ctx.ip,
        user_agent=ctx.user_agent,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
