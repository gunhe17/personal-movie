"""Admin Form Extraction 라우터 — 서식 업로드/지정 → 추출 → 확정(form_template)."""

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

from app.application.handlers.form.confirm_form_extraction import (
    confirm_form_extraction_handler,
)
from app.application.handlers.form.create_form_extraction_from_document import (
    create_form_extraction_from_document_handler,
)
from app.application.handlers.form.delete_form_extraction import (
    delete_form_extraction_handler,
)
from app.application.handlers.form.get_form_extraction import (
    get_form_extraction_handler,
)
from .handlers.list_form_extractions import list_form_extractions_handler
from app.application.handlers.form.retry_form_extraction import (
    retry_form_extraction_handler,
)
from app.application.handlers.form.upload_form_extraction import (
    upload_form_extraction_handler,
)
from .schemas import (
    ConfirmFormExtractionRequest,
    ConfirmFormExtractionResponse,
    FormExtractionAcceptedResponse,
    FormExtractionDetail,
    FormExtractionFromDocumentRequest,
    FormExtractionListResponse,
)

router = APIRouter(tags=["Admin - Form Extraction"])


@router.post(
    "/form-extractions",
    response_model=FormExtractionAcceptedResponse,
    status_code=202,
    description=(
        "비동기 처리 — 즉시 202(Accepted)를 반환하며, "
        "form_extractions.status 폴링으로 completed/failed 를 관찰합니다."
    ),
)
async def upload_form_extraction(
    name: str = Form(...),
    center_id: str | None = Form(default=None),
    file: UploadFile = File(..., description="서식 파일 1장 (PDF/PNG/JPG)"),
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
    return await upload_form_extraction_handler(
        name=name,
        center_id=center_id,
        file=file,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/form-extractions/from-document",
    response_model=FormExtractionAcceptedResponse,
    status_code=202,
)
async def create_form_extraction_from_document(
    data: FormExtractionFromDocumentRequest,
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
    return await create_form_extraction_from_document_handler(
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.get(
    "/form-extractions",
    response_model=FormExtractionListResponse,
)
async def list_form_extractions(
    status: str | None = Query(
        default=None,
        description="상태 필터: started / completed / failed",
        pattern=r"^(?:started|completed|failed)?$",
    ),
    center_id: str | None = Query(default=None, description="센터 필터"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_form_extractions_handler(
        ctx.uow,
        status=status or None,
        center_id=center_id,
        page=page,
        size=size,
    )


@router.get(
    "/form-extractions/{extraction_id}",
    response_model=FormExtractionDetail,
)
async def get_form_extraction(
    extraction_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_form_extraction_handler(extraction_id, ctx.uow)


@router.delete(
    "/form-extractions/{extraction_id}",
    response_model=DetailResponse,
)
async def delete_form_extraction(
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
    return await delete_form_extraction_handler(
        extraction_id=extraction_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/form-extractions/{extraction_id}/retry",
    response_model=FormExtractionAcceptedResponse,
    status_code=202,
)
async def retry_form_extraction(
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
    return await retry_form_extraction_handler(
        extraction_id=extraction_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/form-extractions/{extraction_id}/confirm",
    response_model=ConfirmFormExtractionResponse,
    status_code=201,
    description="form_templates draft(version=1)를 생성하며, extraction 은 completed 로 유지됩니다(이력·재추출).",
)
async def confirm_form_extraction(
    extraction_id: str,
    data: ConfirmFormExtractionRequest,
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
    return await confirm_form_extraction_handler(
        extraction_id=extraction_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
