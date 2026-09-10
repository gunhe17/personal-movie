"""SCT Router — 검사 진행/채점/결과 API"""
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.modules.auth.dependencies import InstitutionContext, get_institution_context
from app.core.unit_of_work import UnitOfWork, get_uow
from app.infrastructure.ai.base import AIService
from app.infrastructure.ai.config import get_ai_service
from app.modules.examination.common.access import require_exam_access
from app.modules.examination.common.schemas import ExaminationResponse
from app.modules.examination.sct.handlers import (
    handle_confirm,
    handle_generate_report_pdf,
    handle_get_results,
    handle_get_stems,
    handle_save_responses,
    handle_score,
    handle_update_score,
)
from app.modules.examination.sct.schemas import (
    SCTResponseSubmit,
    SCTResultsResponse,
    SCTScoreUpdate,
    SCTStemListResponse,
)

router = APIRouter(
    prefix="/institutions/{institution_id}/examinations/{exam_id}/sct",
    tags=["sct"],
    dependencies=[Depends(require_exam_access)],
)


@router.get("/stems", response_model=SCTStemListResponse)
async def get_stems(
    ctx: InstitutionContext = Depends(get_institution_context),
):
    """40문항 stem 데이터 조회 (정적 데이터, 인증만 필요)"""
    return handle_get_stems()


@router.put("/responses", response_model=ExaminationResponse)
async def save_responses(
    body: SCTResponseSubmit,
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """진행 중 응답 저장 (자동 저장 / 최종 제출 공용)"""
    return await handle_save_responses(ctx.institution_id, exam_id, body, uow)


@router.post("/score", response_model=ExaminationResponse)
async def trigger_score(
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
    ai_service: AIService = Depends(get_ai_service),
):
    """AI 채점 트리거 → ai_draft_ready 상태로 전이"""
    return await handle_score(ctx, exam_id, uow, ai_service)


@router.patch("/scores", response_model=ExaminationResponse)
async def update_score(
    body: SCTScoreUpdate,
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """단일 문항 점수 수정 (임상가 검토)"""
    return await handle_update_score(ctx, exam_id, body, uow)


@router.post("/confirm", response_model=ExaminationResponse)
async def confirm(
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """임상가 최종 확인 → confirmed 상태 (CDSS)"""
    return await handle_confirm(ctx, exam_id, uow)


@router.get("/results", response_model=SCTResultsResponse)
async def get_results(
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """SCT 결과 조회 (응답 + 채점)"""
    return await handle_get_results(ctx.institution_id, exam_id, uow)


@router.get("/report/pdf")
async def generate_report_pdf(
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """SCT 보고서 PDF 생성 및 다운로드"""
    pdf_bytes = await handle_generate_report_pdf(ctx, exam_id, uow)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="sct_report_{exam_id[:8]}.pdf"'},
    )
