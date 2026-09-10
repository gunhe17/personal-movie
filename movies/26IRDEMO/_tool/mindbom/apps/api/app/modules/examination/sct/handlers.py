"""SCT Handlers — UoW 트랜잭션 경계 + Facade 호출"""
from app.core.unit_of_work import UnitOfWork
from app.infrastructure.ai.base import AIService
from app.modules.auth.dependencies import InstitutionContext
from app.modules.examination.common.schemas import ExaminationResponse
from app.modules.examination.sct.facade import SCTFacade
from app.modules.examination.sct.schemas import (
    SCTResponseSubmit,
    SCTResultsResponse,
    SCTScoreUpdate,
    SCTStem,
    SCTStemListResponse,
)
from app.modules.examination.sct.stems import get_stems_with_labels


def handle_get_stems() -> SCTStemListResponse:
    stems_data = get_stems_with_labels()
    return SCTStemListResponse(
        stems=[SCTStem(**s) for s in stems_data],
        totalCount=len(stems_data),
    )


async def handle_save_responses(
    institution_id: str,
    exam_id: str,
    body: SCTResponseSubmit,
    uow: UnitOfWork,
) -> ExaminationResponse:
    async with uow:
        result = await SCTFacade(uow).save_responses(exam_id, institution_id, body)
        await uow.commit()
        return result


async def handle_score(
    ctx: InstitutionContext,
    exam_id: str,
    uow: UnitOfWork,
    ai_service: AIService,
) -> ExaminationResponse:
    async with uow:
        result = await SCTFacade(uow, ai_service=ai_service, ctx=ctx).score(
            exam_id, ctx.institution_id
        )
        await uow.commit()
        return result


async def handle_update_score(
    ctx: InstitutionContext,
    exam_id: str,
    body: SCTScoreUpdate,
    uow: UnitOfWork,
) -> ExaminationResponse:
    async with uow:
        result = await SCTFacade(uow, ctx=ctx).update_score(
            exam_id, ctx.institution_id, body.stemId, body.score
        )
        await uow.commit()
        return result


async def handle_confirm(
    ctx: InstitutionContext,
    exam_id: str,
    uow: UnitOfWork,
) -> ExaminationResponse:
    async with uow:
        result = await SCTFacade(uow, ctx=ctx).confirm(exam_id, ctx.institution_id)
        await uow.commit()
        return result


async def handle_get_results(
    institution_id: str,
    exam_id: str,
    uow: UnitOfWork,
) -> SCTResultsResponse:
    async with uow:
        return await SCTFacade(uow).get_results(exam_id, institution_id)


async def handle_generate_report_pdf(
    ctx: InstitutionContext,
    exam_id: str,
    uow: UnitOfWork,
) -> bytes:
    """SCT 보고서 PDF 생성"""
    async with uow:
        pdf_bytes = await SCTFacade(uow, ctx=ctx).generate_report_pdf(exam_id, ctx.institution_id)
        await uow.commit()
        return pdf_bytes
