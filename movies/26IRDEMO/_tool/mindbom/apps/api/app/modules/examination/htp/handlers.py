"""HTP 검사 핸들러 — Facade 호출 + UoW 트랜잭션 관리"""
import logging

from app.core.unit_of_work import UnitOfWork
from app.infrastructure.ai.base import AIService
from app.modules.auth.dependencies import InstitutionContext
from app.modules.examination.htp.facade import HTPFacade
from app.modules.examination.htp.schemas import (
    HTPAnalyzeRequest,
    HTPDrawingResponse,
    HTPDrawingUpdate,
    HTPFullResultsResponse,
    HTPInterpretationResponse,
    HTPResultsUpdate,
    HTPToggleImportantRequest,
)

logger = logging.getLogger(__name__)


async def handle_initialize_drawings(
    ctx: InstitutionContext,
    exam_id: str,
    uow: UnitOfWork,
) -> list[HTPDrawingResponse]:
    async with uow:
        facade = HTPFacade(uow, ctx=ctx)
        result = await facade.initialize_drawings(exam_id, ctx.institution_id)
        await uow.commit()
        return result


async def handle_list_drawings(
    ctx: InstitutionContext,
    exam_id: str,
    uow: UnitOfWork,
) -> list[HTPDrawingResponse]:
    async with uow:
        facade = HTPFacade(uow, ctx=ctx)
        return await facade.list_drawings(exam_id, ctx.institution_id)


async def handle_update_drawing(
    ctx: InstitutionContext,
    exam_id: str,
    drawing_id: str,
    data: HTPDrawingUpdate,
    uow: UnitOfWork,
) -> HTPDrawingResponse:
    async with uow:
        facade = HTPFacade(uow, ctx=ctx)
        result = await facade.update_drawing(
            exam_id, drawing_id, ctx.institution_id, pdi_data=data.pdi_data
        )
        await uow.commit()
        return result


async def handle_upload_image(
    ctx: InstitutionContext,
    exam_id: str,
    drawing_id: str,
    image_data: bytes,
    filename: str,
    uow: UnitOfWork,
) -> HTPDrawingResponse:
    async with uow:
        facade = HTPFacade(uow, ctx=ctx)
        result = await facade.upload_image(
            exam_id, drawing_id, ctx.institution_id, image_data, filename
        )
        await uow.commit()
        return result


async def handle_analyze_htp(
    ctx: InstitutionContext,
    exam_id: str,
    data: HTPAnalyzeRequest,
    uow: UnitOfWork,
    ai_service: AIService,
    actor_member_id: str | None = None,
) -> HTPFullResultsResponse:
    async with uow:
        facade = HTPFacade(uow, ai_service=ai_service, ctx=ctx)
        result = await facade.analyze(
            exam_id, ctx.institution_id, data.drawing_ids,
            actor_member_id=actor_member_id,
        )
        await uow.commit()
        return result


async def handle_reinterpret_htp(
    ctx: InstitutionContext,
    exam_id: str,
    uow: UnitOfWork,
    ai_service: AIService,
    actor_member_id: str | None = None,
) -> HTPFullResultsResponse:
    async with uow:
        facade = HTPFacade(uow, ai_service=ai_service, ctx=ctx)
        result = await facade.reinterpret(
            exam_id, ctx.institution_id, actor_member_id=actor_member_id
        )
        await uow.commit()
        return result


async def handle_get_results(
    ctx: InstitutionContext,
    exam_id: str,
    uow: UnitOfWork,
) -> HTPFullResultsResponse:
    async with uow:
        facade = HTPFacade(uow, ctx=ctx)
        return await facade.get_results(exam_id, ctx.institution_id)


async def handle_update_results(
    ctx: InstitutionContext,
    exam_id: str,
    data: HTPResultsUpdate,
    uow: UnitOfWork,
) -> HTPFullResultsResponse:
    async with uow:
        facade = HTPFacade(uow, ctx=ctx)
        result = await facade.update_results(exam_id, ctx.institution_id, data)
        await uow.commit()
        return result


async def handle_toggle_important(
    ctx: InstitutionContext,
    exam_id: str,
    data: HTPToggleImportantRequest,
    uow: UnitOfWork,
) -> HTPInterpretationResponse:
    async with uow:
        facade = HTPFacade(uow, ctx=ctx)
        result = await facade.toggle_important(exam_id, ctx.institution_id, data)
        await uow.commit()
        return result


async def handle_generate_report_pdf(
    ctx: InstitutionContext,
    exam_id: str,
    uow: UnitOfWork,
    base_url: str = "http://localhost:4502",
    actor_member_id: str | None = None,
) -> bytes:
    """HTP 보고서 PDF 생성"""
    async with uow:
        facade = HTPFacade(uow, ctx=ctx)
        pdf_bytes = await facade.generate_report_pdf(
            exam_id, ctx.institution_id,
            base_url=base_url,
            actor_member_id=actor_member_id,
        )
        await uow.commit()
        return pdf_bytes
