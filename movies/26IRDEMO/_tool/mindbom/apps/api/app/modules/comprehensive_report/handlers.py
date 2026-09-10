"""종합보고서 핸들러 — Facade 호출 + UoW 트랜잭션 관리 (try-except 금지)"""
from app.core.unit_of_work import UnitOfWork
from app.infrastructure.ai.base import AIService
from app.modules.auth.dependencies import InstitutionContext
from app.modules.comprehensive_report.facade import ComprehensiveReportFacade
from app.modules.comprehensive_report.schemas import (
    ComprehensiveReportCreate,
    ComprehensiveReportListResponse,
    ComprehensiveReportResponse,
    ComprehensiveReportUpdate,
    GenerateDraftRequest,
)


async def handle_create_report(
    ctx: InstitutionContext,
    data: ComprehensiveReportCreate,
    uow: UnitOfWork,
) -> ComprehensiveReportResponse:
    async with uow:
        facade = ComprehensiveReportFacade(uow, ctx=ctx)
        result = await facade.create_report(ctx.institution_id, data)
        await uow.commit()
        return result


async def handle_list_reports(
    ctx: InstitutionContext,
    client_id: str,
    uow: UnitOfWork,
) -> ComprehensiveReportListResponse:
    async with uow:
        facade = ComprehensiveReportFacade(uow, ctx=ctx)
        items = await facade.list_reports(ctx.institution_id, client_id)
        return ComprehensiveReportListResponse(items=items, total=len(items))


async def handle_get_report(
    ctx: InstitutionContext,
    report_id: str,
    uow: UnitOfWork,
) -> ComprehensiveReportResponse:
    async with uow:
        facade = ComprehensiveReportFacade(uow, ctx=ctx)
        return await facade.get_report(report_id, ctx.institution_id)


async def handle_update_report(
    ctx: InstitutionContext,
    report_id: str,
    data: ComprehensiveReportUpdate,
    uow: UnitOfWork,
) -> ComprehensiveReportResponse:
    async with uow:
        facade = ComprehensiveReportFacade(uow, ctx=ctx)
        result = await facade.update_report(report_id, ctx.institution_id, data)
        await uow.commit()
        return result


async def handle_generate_draft(
    ctx: InstitutionContext,
    report_id: str,
    data: GenerateDraftRequest,
    uow: UnitOfWork,
    ai_service: AIService,
) -> ComprehensiveReportResponse:
    async with uow:
        facade = ComprehensiveReportFacade(uow, ctx=ctx, ai_service=ai_service)
        result = await facade.generate_draft(report_id, ctx.institution_id, data)
        await uow.commit()
        return result


async def handle_confirm_report(
    ctx: InstitutionContext,
    report_id: str,
    uow: UnitOfWork,
) -> ComprehensiveReportResponse:
    async with uow:
        facade = ComprehensiveReportFacade(uow, ctx=ctx)
        result = await facade.confirm_report(report_id, ctx.institution_id)
        await uow.commit()
        return result


async def handle_generate_pdf(
    ctx: InstitutionContext,
    report_id: str,
    uow: UnitOfWork,
) -> bytes:
    async with uow:
        facade = ComprehensiveReportFacade(uow, ctx=ctx)
        pdf_bytes = await facade.generate_report_pdf(report_id, ctx.institution_id)
        await uow.commit()
        return pdf_bytes
