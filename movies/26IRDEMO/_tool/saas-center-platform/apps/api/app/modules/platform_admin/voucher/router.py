"""Admin Voucher 라우터 — 카탈로그 CRUD + 자료 링크(voucher_documents) + 추출(voucher_extractions)."""

from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
    with_batch_dispatcher,
)
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.core.schemas import DetailResponse
from app.modules.platform_admin.auth.dependencies import ADMIN_PLUS

from app.application.handlers.voucher.confirm_voucher_extraction import (
    confirm_voucher_extraction_handler,
)
from app.application.handlers.voucher import create_voucher_handler
from app.application.handlers.voucher.create_voucher_document import create_voucher_document_handler
from app.application.handlers.voucher import (
    delete_voucher_handler,
    update_voucher_handler,
)
from app.application.handlers.voucher.delete_voucher_document import delete_voucher_document_handler
from app.application.handlers.voucher.delete_voucher_extraction import (
    delete_voucher_extraction_handler,
)
from app.application.handlers.voucher.get_admin_voucher import get_admin_voucher_handler
from app.application.handlers.voucher.get_voucher_extraction import get_voucher_extraction_handler
from app.application.handlers.voucher.list_global_documents import list_global_documents_handler
from app.application.handlers.voucher.list_voucher_documents import list_voucher_documents_handler
from app.application.handlers.voucher.list_voucher_extractions import (
    list_voucher_extractions_handler,
)
from .handlers.list_vouchers import list_vouchers_handler
from app.application.handlers.voucher.retry_voucher_extraction import retry_voucher_extraction_handler
from app.application.handlers.voucher.confirm_voucher_layout import confirm_voucher_layout_handler
from app.application.handlers.voucher.stop_voucher_extraction import stop_voucher_extraction_handler
from app.application.handlers.voucher.resume_voucher_extraction import resume_voucher_extraction_handler
from app.application.handlers.voucher.upload_voucher_extraction import (
    upload_voucher_extraction_handler,
)
from .schemas import (
    ConfirmLayoutRequest,
    AdminDocumentListResponse,
    AdminVoucherCreateRequest,
    AdminVoucherDetailResponse,
    AdminVoucherListResponse,
    AdminVoucherUpdateRequest,
    ConfirmExtractionRequest,
    ConfirmExtractionResponse,
    ExtractionAcceptedResponse,
    VoucherDocumentLinkCreateRequest,
    VoucherDocumentLinkResponse,
    VoucherExtractionDetail,
    VoucherExtractionListResponse,
    VoucherFileType,
)

router = APIRouter(tags=["Admin - Voucher"])


@router.get(
    "/vouchers",
    response_model=AdminVoucherListResponse,
)
async def list_vouchers(
    q: str | None = Query(default=None, description="검색어"),
    year: int | None = Query(default=None, description="사업 연도 필터"),
    organization: str | None = Query(default=None, description="사업 기관 필터"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_vouchers_handler(
        ctx.uow,
        q=q,
        year=year,
        organization=organization,
        page=page,
        size=size,
    )


@router.get(
    "/vouchers/{voucher_id}",
    response_model=AdminVoucherDetailResponse,
)
async def get_voucher(
    voucher_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_admin_voucher_handler(voucher_id, ctx.uow)


@router.post(
    "/vouchers",
    response_model=AdminVoucherDetailResponse,
    status_code=201,
)
async def create_voucher(
    data: AdminVoucherCreateRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await create_voucher_handler(
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.patch(
    "/vouchers/{voucher_id}",
    response_model=AdminVoucherDetailResponse,
)
async def update_voucher(
    voucher_id: str,
    data: AdminVoucherUpdateRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await update_voucher_handler(
        voucher_id=voucher_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.delete(
    "/vouchers/{voucher_id}",
    response_model=DetailResponse,
)
async def delete_voucher(
    voucher_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_voucher_handler(
        voucher_id=voucher_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.get(
    "/documents",
    response_model=AdminDocumentListResponse,
)
async def list_documents(
    q: str | None = Query(default=None, description="문서명 검색어"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_global_documents_handler(ctx.uow, q=q, page=page, size=size)


@router.get(
    "/vouchers/{voucher_id}/documents",
    response_model=list[VoucherDocumentLinkResponse],
)
async def list_voucher_documents(
    voucher_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_voucher_documents_handler(voucher_id, ctx.uow)


@router.post(
    "/vouchers/{voucher_id}/documents",
    response_model=VoucherDocumentLinkResponse,
    status_code=201,
)
async def create_voucher_document(
    voucher_id: str,
    data: VoucherDocumentLinkCreateRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await create_voucher_document_handler(
        voucher_id=voucher_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.delete(
    "/vouchers/{voucher_id}/documents/{global_document_id}",
    response_model=DetailResponse,
)
async def delete_voucher_document(
    voucher_id: str,
    global_document_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_voucher_document_handler(
        voucher_id=voucher_id,
        global_document_id=global_document_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/voucher-extractions",
    response_model=ExtractionAcceptedResponse,
    status_code=202,
    description=(
        "비동기 처리 — 업로드가 곧 추출 시작(별도 트리거 단계 없음). "
        "즉시 202(Accepted)를 반환하며, voucher_extractions.status 폴링으로 "
        "completed/failed 를 관찰합니다."
    ),
)
async def upload_voucher_extraction(
    name: str = Form(...),
    type: VoucherFileType = Form(...),
    source_url: str | None = Form(default=None),
    files: list[UploadFile] = File(
        default_factory=list,
        description="같은 자료의 여러 확장자(PDF/HWPX 등)를 한 번에 묶어 업로드.",
    ),
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
            with_batch_dispatcher(),
        )
    ),
):
    return await upload_voucher_extraction_handler(
        name=name,
        type=type,
        source_url=source_url,
        files=files,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.get(
    "/voucher-extractions",
    response_model=VoucherExtractionListResponse,
)
async def list_voucher_extractions(
    status: str | None = Query(
        default=None,
        description="상태 필터: started / completed / failed",
        pattern=r"^(?:started|completed|failed)?$",
    ),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_voucher_extractions_handler(
        ctx.uow, status=status or None, page=page, size=size
    )


@router.get(
    "/voucher-extractions/{extraction_id}",
    response_model=VoucherExtractionDetail,
)
async def get_voucher_extraction(
    extraction_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_voucher_extraction_handler(extraction_id, ctx.uow)


@router.delete(
    "/voucher-extractions/{extraction_id}",
    response_model=DetailResponse,
)
async def delete_voucher_extraction(
    extraction_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_voucher_extraction_handler(
        extraction_id=extraction_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/voucher-extractions/{extraction_id}/retry",
    response_model=ExtractionAcceptedResponse,
    status_code=202,
)
async def retry_voucher_extraction(
    extraction_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
            with_batch_dispatcher(),
        )
    ),
):
    return await retry_voucher_extraction_handler(
        extraction_id=extraction_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/voucher-extractions/{extraction_id}/stop",
    response_model=ExtractionAcceptedResponse,
    status_code=202,
)
async def stop_voucher_extraction(
    extraction_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
            with_batch_dispatcher(),
        )
    ),
):
    return await stop_voucher_extraction_handler(
        extraction_id=extraction_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/voucher-extractions/{extraction_id}/confirm-layout",
    response_model=ExtractionAcceptedResponse,
    status_code=202,
)
async def confirm_voucher_layout(
    extraction_id: str,
    data: ConfirmLayoutRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
            with_batch_dispatcher(),
        )
    ),
):
    return await confirm_voucher_layout_handler(
        extraction_id=extraction_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/voucher-extractions/{extraction_id}/resume",
    response_model=ExtractionAcceptedResponse,
    status_code=202,
)
async def resume_voucher_extraction(
    extraction_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
            with_batch_dispatcher(),
        )
    ),
):
    return await resume_voucher_extraction_handler(
        extraction_id=extraction_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/voucher-extractions/{extraction_id}/confirm",
    response_model=ConfirmExtractionResponse,
    status_code=201,
    description=(
        "voucher 카탈로그로 멱등 승격(name·year·organization 기준 upsert)하며, "
        "extraction 은 completed 로 유지됩니다."
    ),
)
async def confirm_voucher_extraction(
    extraction_id: str,
    data: ConfirmExtractionRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await confirm_voucher_extraction_handler(
        extraction_id=extraction_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
