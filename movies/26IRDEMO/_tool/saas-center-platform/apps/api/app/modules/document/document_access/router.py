from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
)
from fastapi import APIRouter, Depends, Query
from .handlers import (
    list_document_accesses_handler,
    list_account_accesses_handler,
)
from .schemas import DocumentAccessListResponse

router = APIRouter(prefix="/centers/{center_id}/document-accesses", tags=["document-access"])


@router.get(
    "/documents/{document_id}",
    response_model=DocumentAccessListResponse,
)
async def list_document_accesses(
    document_id: str,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(50, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_document_accesses_handler(
        document_id=document_id,
        center_id=ctx.center_id,
        page=page,
        size=size,
        uow=ctx.uow,
    )


@router.get(
    "/accounts/{account_id}",
    response_model=DocumentAccessListResponse,
)
async def list_account_accesses(
    account_id: str,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(50, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_account_accesses_handler(
        account_id=account_id,
        center_id=ctx.center_id,
        page=page,
        size=size,
        uow=ctx.uow,
    )
