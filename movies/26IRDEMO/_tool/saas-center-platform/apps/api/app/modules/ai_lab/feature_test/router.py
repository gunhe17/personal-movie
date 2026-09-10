"""Admin AI Lab 기능 테스트 래퍼 엔드포인트.

센터 사용자 API와 동일한 핸들러를 admin 인증으로 호출.
센터 멤버십 없이 center_id를 path parameter로 받아 테스트.
"""

from fastapi import APIRouter, Body, Depends, Query

from app.behavior import (
    behavior,
    AdminContext,
    UnscopedContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from app.modules.platform_admin.admin_account.models import AdminRole

# -- Schemas --
from app.modules.llm.schemas import CreditBalanceResponse
from app.modules.field_note.field_note.schemas import (
    FieldNoteListResponse,
    FieldNoteDetailResponse,
)
from app.modules.field_note.pipeline.schemas import (
    GenerateCounselingNoteRequest,
    PipelineStepResponse,
)
from app.application.schemas import CounselingCaseListResponse
from app.core.schemas import StatusMessageResponse
from app.modules.counseling.counseling_case_analysis.schemas import (
    CaseAnalysisPreviewResponse,
    CaseAnalysisResponse,
)

router = APIRouter(
    prefix="/admin/ai-lab/feature-test",
    tags=["Admin - AI Lab Feature Test"],
)


@router.get(
    "/{center_id}/credit",
    response_model=CreditBalanceResponse | None,
)
async def get_credit(
    center_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    from app.modules.llm.handlers import get_credit_balance_handler

    return await get_credit_balance_handler(
        center_id=center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
    )


@router.get(
    "/{center_id}/field-notes",
    response_model=FieldNoteListResponse,
)
async def list_field_notes(
    center_id: str,
    status: str | None = Query("completed", description="상태 필터"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    from app.application.handlers.field_note import (
        list_field_notes_with_brief_handler,
    )

    return await list_field_notes_with_brief_handler(
        center_id=center_id,
        uow=ctx.uow,
        status=status,
        page=page,
        size=size,
    )


@router.get(
    "/{center_id}/field-notes/{field_note_id}",
    response_model=FieldNoteDetailResponse,
)
async def get_field_note(
    center_id: str,
    field_note_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    from app.application.handlers.field_note.get_field_note_detail import (
        get_field_note_detail_handler,
    )

    return await get_field_note_detail_handler(
        field_note_id=field_note_id,
        center_id=center_id,
        uow=ctx.uow,
    )


@router.post(
    "/{center_id}/field-notes/{field_note_id}/transcribe",
    response_model=PipelineStepResponse,
)
async def transcribe(
    center_id: str,
    field_note_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    from app.modules.field_note.pipeline.handlers import transcribe_handler

    return await transcribe_handler(
        field_note_id=field_note_id,
        center_id=center_id,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{center_id}/field-notes/{field_note_id}/refine",
    response_model=PipelineStepResponse,
)
async def refine(
    center_id: str,
    field_note_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    from app.modules.field_note.pipeline.handlers import refine_handler

    return await refine_handler(
        field_note_id=field_note_id,
        center_id=center_id,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{center_id}/field-notes/{field_note_id}/generate-summary",
    response_model=PipelineStepResponse,
)
async def generate_summary(
    center_id: str,
    field_note_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    from app.modules.field_note.pipeline.handlers import generate_summary_handler

    return await generate_summary_handler(
        field_note_id=field_note_id,
        center_id=center_id,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{center_id}/field-notes/{field_note_id}/generate-counseling-note",
    response_model=PipelineStepResponse,
)
async def generate_counseling_note(
    center_id: str,
    field_note_id: str,
    data: GenerateCounselingNoteRequest | None = Body(None),
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    from app.application.handlers.field_note import (
        generate_counseling_note_handler,
    )

    return await generate_counseling_note_handler(
        field_note_id=field_note_id,
        center_id=center_id,
        author_id=ctx.admin_account_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        note_template_type=data.note_template_type if data else None,
    )


@router.get(
    "/{center_id}/counseling-cases",
    response_model=CounselingCaseListResponse,
)
async def list_counseling_cases(
    center_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    from app.application.handlers.counseling import (
        list_counseling_cases_enriched_handler,
    )

    return await list_counseling_cases_enriched_handler(
        center_id=center_id,
        counselor_id=None,
        status=None,
        page=page,
        size=size,
        uow=ctx.uow,
    )


@router.get(
    "/{center_id}/cases/{case_id}/analysis/preview",
    response_model=CaseAnalysisPreviewResponse,
)
async def preview_analysis(
    center_id: str,
    case_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    from app.modules.counseling.counseling_case_analysis.handlers import (
        preview_case_analysis_handler,
    )

    return await preview_case_analysis_handler(case_id, center_id, ctx.uow)


@router.post(
    "/{center_id}/cases/{case_id}/analysis",
    status_code=202,
    response_model=StatusMessageResponse,
)
async def create_analysis(
    center_id: str,
    case_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    from app.modules.counseling.counseling_case_analysis.handlers import (
        create_case_analysis_handler,
    )

    return await create_case_analysis_handler(
        event_group_id=ctx.event_group_id,
        case_id=case_id,
        center_id=center_id,
        member_id=ctx.admin_account_id,
        account_id=ctx.admin_account_id,
        uow=ctx.uow,
        actor_id=ctx.admin_account_id,
    )


@router.get(
    "/{center_id}/cases/{case_id}/analysis/latest",
    response_model=CaseAnalysisResponse | None,
)
async def get_latest_analysis(
    center_id: str,
    case_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    from app.modules.counseling.counseling_case_analysis.handlers import (
        get_latest_case_analysis_handler,
    )

    return await get_latest_case_analysis_handler(case_id, center_id, ctx.uow)
