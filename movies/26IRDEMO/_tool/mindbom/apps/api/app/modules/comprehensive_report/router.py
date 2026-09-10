"""종합보고서 라우터

권한은 facade에서 강제(경로에 단일 exam_id가 없어 require_exam_access 미부착).
"""
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response

from app.core.unit_of_work import UnitOfWork, get_uow
from app.infrastructure.ai.base import AIService
from app.infrastructure.ai.config import get_ai_service
from app.modules.auth.dependencies import InstitutionContext, get_institution_context
from app.modules.comprehensive_report.handlers import (
    handle_confirm_report,
    handle_create_report,
    handle_generate_draft,
    handle_generate_pdf,
    handle_get_report,
    handle_list_reports,
    handle_update_report,
)
from app.modules.comprehensive_report.schemas import (
    ComprehensiveReportCreate,
    ComprehensiveReportListResponse,
    ComprehensiveReportResponse,
    ComprehensiveReportUpdate,
    GenerateDraftRequest,
)

router = APIRouter(
    prefix="/institutions/{institution_id}/comprehensive-reports",
    tags=["comprehensive-reports"],
)


@router.post("", response_model=ComprehensiveReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    data: ComprehensiveReportCreate,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """종합보고서 생성 — 복수 검사 선택 → auto 섹션 seed"""
    return await handle_create_report(ctx, data, uow)


@router.get("", response_model=ComprehensiveReportListResponse)
async def list_reports(
    client_id: str = Query(...),
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """내담자별 종합보고서 목록"""
    return await handle_list_reports(ctx, client_id, uow)


@router.get("/{report_id}", response_model=ComprehensiveReportResponse)
async def get_report(
    report_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """종합보고서 조회 (섹션 + 링크 검사 포함)"""
    return await handle_get_report(ctx, report_id, uow)


@router.patch("/{report_id}", response_model=ComprehensiveReportResponse)
async def update_report(
    report_id: str,
    data: ComprehensiveReportUpdate,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """섹션/제목/비고 저장 (임상가 편집)"""
    return await handle_update_report(ctx, report_id, data, uow)


@router.post("/{report_id}/generate-draft", response_model=ComprehensiveReportResponse)
async def generate_draft(
    report_id: str,
    data: GenerateDraftRequest,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
    ai_service: AIService = Depends(get_ai_service),
):
    """AI 종합 초안 생성 (Mock-first 룰베이스 폴백)"""
    return await handle_generate_draft(ctx, report_id, data, uow, ai_service)


@router.post("/{report_id}/confirm", response_model=ComprehensiveReportResponse)
async def confirm_report(
    report_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """보고서 확정 (clinician/admin만)"""
    return await handle_confirm_report(ctx, report_id, uow)


@router.get("/{report_id}/report/pdf")
async def generate_report_pdf(
    report_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """종합보고서 PDF 생성 및 다운로드"""
    pdf_bytes = await handle_generate_pdf(ctx, report_id, uow)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="comprehensive_report_{report_id[:8]}.pdf"'},
    )
