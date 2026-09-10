"""로르샤하 Handlers — UoW 트랜잭션 경계 + Facade 호출"""
from app.core.unit_of_work import UnitOfWork
from app.infrastructure.ai.config import get_ai_service
from app.modules.auth.dependencies import InstitutionContext
from app.modules.examination.rorschach.facade import RorschachFacade
from app.modules.examination.rorschach.schemas import (
    AudioUrlResponse,
    CardAdministrationResponse,
    CardStatusUpdate,
    CodingUpdateRequest,
    InterventionCreate,
    InterventionResponse,
    RegionCreate,
    RegionResponse,
    RegionUpdate,
    ResponseCreate,
    ResponseDetail,
    ResponseUpdate,
    SessionCompleteRequest,
    SessionDetailResponse,
    SessionResponse,
    SessionStartResponse,
    SessionWithRegionsResponse,
    StructuralSummaryResponse,
    TranscriptClipResponse,
    TranscriptResponse,
)


async def handle_create_response(
    ctx: InstitutionContext,
    examination_id: str,
    data: ResponseCreate,
    uow: UnitOfWork,
) -> ResponseDetail:
    async with uow:
        result = await RorschachFacade(uow, ctx=ctx).create_response(
            examination_id, ctx.institution_id, data,
        )
        await uow.commit()
        return result


async def handle_update_response(
    ctx: InstitutionContext,
    examination_id: str,
    response_id: str,
    data: ResponseUpdate,
    uow: UnitOfWork,
) -> ResponseDetail:
    async with uow:
        result = await RorschachFacade(uow, ctx=ctx).update_response(
            examination_id, ctx.institution_id, response_id, data,
        )
        await uow.commit()
        return result


async def handle_delete_response(
    ctx: InstitutionContext,
    examination_id: str,
    response_id: str,
    uow: UnitOfWork,
) -> None:
    async with uow:
        await RorschachFacade(uow, ctx=ctx).delete_response(
            examination_id, ctx.institution_id, response_id,
        )
        await uow.commit()


async def handle_set_card_status(
    ctx: InstitutionContext,
    examination_id: str,
    card_no: int,
    data: CardStatusUpdate,
    uow: UnitOfWork,
) -> CardAdministrationResponse:
    async with uow:
        result = await RorschachFacade(uow, ctx=ctx).set_card_status(
            examination_id, ctx.institution_id, card_no, data,
        )
        await uow.commit()
        return result


async def handle_create_intervention(
    ctx: InstitutionContext,
    examination_id: str,
    data: InterventionCreate,
    uow: UnitOfWork,
) -> InterventionResponse:
    async with uow:
        result = await RorschachFacade(uow, ctx=ctx).create_intervention(
            examination_id, ctx.institution_id, data,
        )
        await uow.commit()
        return result


async def handle_delete_intervention(
    ctx: InstitutionContext,
    examination_id: str,
    intervention_id: str,
    uow: UnitOfWork,
) -> dict:
    async with uow:
        await RorschachFacade(uow, ctx=ctx).delete_intervention(
            examination_id, ctx.institution_id, intervention_id,
        )
        await uow.commit()
        return {"message": "개입 기록이 취소되었습니다."}


async def handle_transcribe_clip(
    ctx: InstitutionContext,
    examination_id: str,
    audio_bytes: bytes,
    filename: str,
    duration_sec: float | None,
    uow: UnitOfWork,
) -> TranscriptClipResponse:
    async with uow:
        return await RorschachFacade(uow, ctx=ctx).transcribe_clip(
            examination_id, ctx.institution_id, audio_bytes, filename, duration_sec,
        )


async def handle_start_session(
    institution_id: str,
    examination_id: str,
    uow: UnitOfWork,
) -> SessionStartResponse:
    async with uow:
        result = await RorschachFacade(uow).start_session(examination_id, institution_id)
        await uow.commit()
        return result


async def handle_get_session(
    institution_id: str,
    examination_id: str,
    uow: UnitOfWork,
) -> SessionWithRegionsResponse:
    async with uow:
        return await RorschachFacade(uow).get_session(examination_id, institution_id)


async def handle_create_region(
    institution_id: str,
    examination_id: str,
    data: RegionCreate,
    uow: UnitOfWork,
) -> RegionResponse:
    async with uow:
        result = await RorschachFacade(uow).create_region(examination_id, institution_id, data)
        await uow.commit()
        return result


async def handle_update_region(
    institution_id: str,
    examination_id: str,
    region_id: str,
    data: RegionUpdate,
    uow: UnitOfWork,
) -> RegionResponse:
    async with uow:
        result = await RorschachFacade(uow).update_region(
            examination_id, institution_id, region_id, data,
        )
        await uow.commit()
        return result


async def handle_delete_region(
    institution_id: str,
    examination_id: str,
    region_id: str,
    uow: UnitOfWork,
) -> dict:
    async with uow:
        await RorschachFacade(uow).delete_region(examination_id, institution_id, region_id)
        await uow.commit()
        return {"message": "영역이 삭제되었습니다."}


async def handle_complete_session(
    institution_id: str,
    examination_id: str,
    data: SessionCompleteRequest,
    uow: UnitOfWork,
) -> SessionResponse:
    async with uow:
        result = await RorschachFacade(uow).complete_session(
            examination_id, institution_id, data,
        )
        await uow.commit()
        return result


async def handle_upload_audio(
    institution_id: str,
    examination_id: str,
    audio_bytes: bytes,
    filename: str,
    content_type: str,
    uow: UnitOfWork,
) -> SessionResponse:
    async with uow:
        result = await RorschachFacade(uow).upload_audio(
            examination_id, institution_id, audio_bytes, filename, content_type
        )
        await uow.commit()
        return result


async def handle_ensure_transcript(
    institution_id: str,
    examination_id: str,
    uow: UnitOfWork,
) -> TranscriptResponse:
    async with uow:
        result = await RorschachFacade(uow).ensure_transcript(
            examination_id, institution_id,
        )
        # transcript_json이 새로 채워질 수 있으므로 commit 필요
        await uow.commit()
        return result


async def handle_get_audio_url(
    institution_id: str,
    examination_id: str,
    uow: UnitOfWork,
) -> AudioUrlResponse:
    async with uow:
        return await RorschachFacade(uow).get_audio_url(examination_id, institution_id)


# === Phase 3: 채점 / 검토 / 확정 ===

async def handle_get_session_detail(
    institution_id: str,
    examination_id: str,
    uow: UnitOfWork,
) -> SessionDetailResponse:
    async with uow:
        return await RorschachFacade(uow).get_session_detail(examination_id, institution_id)


async def handle_score_session(
    ctx: InstitutionContext,
    examination_id: str,
    uow: UnitOfWork,
) -> SessionDetailResponse:
    async with uow:
        facade = RorschachFacade(uow, ai_service=get_ai_service(), ctx=ctx)
        result = await facade.score_session(examination_id, ctx.institution_id)
        await uow.commit()
        return result


async def handle_score_response(
    institution_id: str,
    examination_id: str,
    response_id: str,
    transcript_text: str | None,
    uow: UnitOfWork,
) -> ResponseDetail:
    async with uow:
        facade = RorschachFacade(uow, ai_service=get_ai_service())
        result = await facade.score_response(
            examination_id, institution_id, response_id, transcript_text
        )
        await uow.commit()
        return result


async def handle_update_response_coding(
    ctx: InstitutionContext,
    examination_id: str,
    response_id: str,
    data: CodingUpdateRequest,
    uow: UnitOfWork,
) -> ResponseDetail:
    async with uow:
        result = await RorschachFacade(uow, ctx=ctx).update_response_coding(
            examination_id, ctx.institution_id, response_id, data,
        )
        await uow.commit()
        return result


async def handle_confirm_session(
    ctx: InstitutionContext,
    examination_id: str,
    confirmed_by: str | None,
    uow: UnitOfWork,
) -> SessionDetailResponse:
    async with uow:
        result = await RorschachFacade(uow, ctx=ctx).confirm_session(
            examination_id, ctx.institution_id, confirmed_by,
        )
        await uow.commit()
        return result


async def handle_get_structural_summary(
    institution_id: str,
    examination_id: str,
    uow: UnitOfWork,
) -> StructuralSummaryResponse:
    async with uow:
        return await RorschachFacade(uow).get_structural_summary(
            examination_id, institution_id,
        )


async def handle_generate_report_pdf(
    ctx: InstitutionContext,
    examination_id: str,
    uow: UnitOfWork,
) -> bytes:
    """로르샤하 보고서 PDF 생성"""
    async with uow:
        pdf_bytes = await RorschachFacade(uow, ctx=ctx).generate_report_pdf(
            examination_id, ctx.institution_id,
        )
        await uow.commit()
        return pdf_bytes
