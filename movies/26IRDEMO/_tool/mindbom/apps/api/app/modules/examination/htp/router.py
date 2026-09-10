"""HTP 검사 라우터"""
from fastapi import APIRouter, Depends, Request, UploadFile, File
from fastapi.responses import Response

from app.modules.auth.dependencies import InstitutionContext, get_institution_context
from app.core.unit_of_work import UnitOfWork, get_uow
from app.infrastructure.ai.base import AIService
from app.infrastructure.ai.config import get_ai_service
from app.modules.examination.common.access import require_exam_access
from app.modules.examination.htp.schemas import (
    HTPAnalyzeRequest,
    HTPDrawingResponse,
    HTPDrawingUpdate,
    HTPFullResultsResponse,
    HTPInterpretationResponse,
    HTPResultsUpdate,
    HTPToggleImportantRequest,
)
from app.modules.examination.htp.handlers import (
    handle_analyze_htp,
    handle_generate_report_pdf,
    handle_get_results,
    handle_initialize_drawings,
    handle_list_drawings,
    handle_reinterpret_htp,
    handle_toggle_important,
    handle_update_drawing,
    handle_update_results,
    handle_upload_image,
)

router = APIRouter(
    prefix="/institutions/{institution_id}/examinations/{exam_id}/htp",
    tags=["htp"],
    dependencies=[Depends(require_exam_access)],
)


@router.post("/drawings/initialize", response_model=list[HTPDrawingResponse])
async def initialize_drawings(
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """HTP 검사 시작 — 4개 Drawing 초기화"""
    return await handle_initialize_drawings(ctx, exam_id, uow)


@router.get("/drawings", response_model=list[HTPDrawingResponse])
async def list_drawings(
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """HTP Drawing 목록 조회"""
    return await handle_list_drawings(ctx, exam_id, uow)


@router.put("/drawings/{drawing_id}", response_model=HTPDrawingResponse)
async def update_drawing(
    exam_id: str,
    drawing_id: str,
    data: HTPDrawingUpdate,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """Drawing 수정 (PDI 등)"""
    return await handle_update_drawing(ctx, exam_id, drawing_id, data, uow)


@router.put("/drawings/{drawing_id}/image", response_model=HTPDrawingResponse)
async def upload_drawing_image(
    exam_id: str,
    drawing_id: str,
    image: UploadFile = File(...),
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """Drawing 이미지 업로드"""
    image_data = await image.read()
    return await handle_upload_image(ctx, exam_id, drawing_id, image_data, image.filename or "image.png", uow
    )


@router.post("/analyze", response_model=HTPFullResultsResponse)
async def analyze_htp(
    exam_id: str,
    data: HTPAnalyzeRequest,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
    ai_service: AIService = Depends(get_ai_service),
):
    """AI 분석 실행"""
    return await handle_analyze_htp(ctx, exam_id, data, uow, ai_service,
        actor_member_id=ctx.member_id,
    )


@router.post("/reinterpret", response_model=HTPFullResultsResponse)
async def reinterpret_htp(
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
    ai_service: AIService = Depends(get_ai_service),
):
    """수정된 탐지 결과로 해석만 재생성 (재탐지 없음)"""
    return await handle_reinterpret_htp(
        ctx, exam_id, uow, ai_service, actor_member_id=ctx.member_id
    )


@router.get("/results", response_model=HTPFullResultsResponse)
async def get_results(
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """HTP 전체 결과 조회"""
    return await handle_get_results(ctx, exam_id, uow)


@router.patch("/results", response_model=HTPFullResultsResponse)
async def update_results(
    exam_id: str,
    data: HTPResultsUpdate,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """결과 부분 수정 (임상가 편집)"""
    return await handle_update_results(ctx, exam_id, data, uow)


@router.get("/report/pdf")
async def generate_report_pdf(
    exam_id: str,
    request: Request,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """HTP 보고서 PDF 생성 및 다운로드"""
    base_url = str(request.base_url).rstrip("/")
    pdf_bytes = await handle_generate_report_pdf(ctx, exam_id, uow, base_url,
        actor_member_id=ctx.member_id,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="htp_report_{exam_id[:8]}.pdf"'},
    )


@router.post("/interpretations/toggle-important", response_model=HTPInterpretationResponse)
async def toggle_important(
    exam_id: str,
    data: HTPToggleImportantRequest,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """중요 소견 토글"""
    return await handle_toggle_important(ctx, exam_id, data, uow)
