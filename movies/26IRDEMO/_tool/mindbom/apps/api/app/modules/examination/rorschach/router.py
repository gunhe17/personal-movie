"""로르샤하 Router"""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response

from app.modules.auth.dependencies import (
    InstitutionContext,
    get_institution_context,
)
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.examination.common.access import require_exam_access
from app.modules.examination.rorschach.handlers import (
    handle_complete_session,
    handle_confirm_session,
    handle_create_region,
    handle_delete_region,
    handle_ensure_transcript,
    handle_get_audio_url,
    handle_generate_report_pdf,
    handle_get_session,
    handle_get_session_detail,
    handle_get_structural_summary,
    handle_create_intervention,
    handle_delete_intervention,
    handle_create_response,
    handle_delete_response,
    handle_score_response,
    handle_set_card_status,
    handle_transcribe_clip,
    handle_update_response,
    handle_score_session,
    handle_start_session,
    handle_update_region,
    handle_update_response_coding,
    handle_upload_audio,
)
from app.modules.examination.rorschach.schemas import (
    AudioUrlResponse,
    CodingUpdateRequest,
    RegionCreate,
    RegionResponse,
    RegionUpdate,
    ResponseDetail,
    CardAdministrationResponse,
    CardStatusUpdate,
    InterventionCreate,
    InterventionResponse,
    ResponseCreate,
    ResponseUpdate,
    ScoreResponseRequest,
    SessionCompleteRequest,
    SessionDetailResponse,
    SessionResponse,
    SessionStartResponse,
    SessionWithRegionsResponse,
    StructuralSummaryResponse,
    TranscriptClipResponse,
    TranscriptResponse,
)

router = APIRouter(
    prefix="/institutions/{institution_id}/examinations/{examination_id}/rorschach",
    tags=["rorschach"],
    dependencies=[Depends(require_exam_access)],
)


@router.post("/start", response_model=SessionStartResponse, status_code=200)
async def start_session(
    examination_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_start_session(ctx.institution_id, examination_id, uow)


@router.get("", response_model=SessionWithRegionsResponse)
async def get_session(
    examination_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_get_session(ctx.institution_id, examination_id, uow)


@router.post("/responses", response_model=ResponseDetail, status_code=201)
async def create_response(
    examination_id: str,
    data: ResponseCreate,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """반응 기록 — 자유반응 단계(§4-1). 영역 없이도 유효하다."""
    return await handle_create_response(ctx, examination_id, data, uow)


@router.patch("/responses/{response_id}", response_model=ResponseDetail)
async def update_response(
    examination_id: str,
    response_id: str,
    data: ResponseUpdate,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_update_response(ctx, examination_id, response_id, data, uow)


@router.delete("/responses/{response_id}")
async def delete_response(
    examination_id: str,
    response_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_delete_response(ctx, examination_id, response_id, uow)


@router.put("/cards/{card_no}/status", response_model=CardAdministrationResponse)
async def set_card_status(
    examination_id: str,
    card_no: int,
    data: CardStatusUpdate,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """카드 실시 기록(§5-2) — 거부와 미입력을 구분한다."""
    return await handle_set_card_status(ctx, examination_id, card_no, data, uow)


@router.post("/interventions", response_model=InterventionResponse, status_code=201)
async def create_intervention(
    examination_id: str,
    data: InterventionCreate,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """검사자 개입 기록(§4-1) — 촉구·한계검증 등."""
    return await handle_create_intervention(ctx, examination_id, data, uow)


@router.delete("/interventions/{intervention_id}")
async def delete_intervention(
    examination_id: str,
    intervention_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """개입 기록 취소 — 실시 중 오조작을 되돌린다. soft delete라 이력은 남는다."""
    return await handle_delete_intervention(ctx, examination_id, intervention_id, uow)


@router.post("/regions", response_model=RegionResponse, status_code=201)
async def create_region(
    examination_id: str,
    data: RegionCreate,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_create_region(ctx.institution_id, examination_id, data, uow)


@router.patch("/regions/{region_id}", response_model=RegionResponse)
async def update_region(
    examination_id: str,
    region_id: str,
    data: RegionUpdate,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_update_region(ctx.institution_id, examination_id, region_id, data, uow)


@router.delete("/regions/{region_id}")
async def delete_region(
    examination_id: str,
    region_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_delete_region(ctx.institution_id, examination_id, region_id, uow)


@router.post("/complete", response_model=SessionResponse)
async def complete_session(
    examination_id: str,
    data: SessionCompleteRequest,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_complete_session(ctx.institution_id, examination_id, data, uow)


@router.post("/transcribe-clip", response_model=TranscriptClipResponse)
async def transcribe_clip(
    examination_id: str,
    audio: UploadFile = File(...),
    duration_sec: float | None = Form(None),
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """발화 한 조각 전사 — 반응 단위 즉시 배치(§3-3).

    세션 전체를 돌리는 /transcript와 다르다. 화면이 발화를 감지해 그 구간만
    보내면 초안을 돌려준다. **저장하지 않는다** — 무엇을 반응으로 삼을지는
    임상가가 정한다.
    """
    audio_bytes = await audio.read()
    return await handle_transcribe_clip(
        ctx,
        examination_id,
        audio_bytes,
        audio.filename or "clip.webm",
        duration_sec,
        uow,
    )


@router.post("/audio", response_model=SessionResponse)
async def upload_audio(
    examination_id: str,
    audio: UploadFile = File(...),
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """오디오 업로드 → storage 저장 (전사는 별도 endpoint에서 lazy 트리거)"""
    audio_bytes = await audio.read()
    return await handle_upload_audio(
        ctx.institution_id,
        examination_id,
        audio_bytes,
        audio.filename or "audio.webm",
        audio.content_type or "audio/webm",
        uow,
    )


@router.post("/transcript", response_model=TranscriptResponse)
async def ensure_transcript(
    examination_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """transcript 보장 — 캐시 있으면 그대로, 없으면 OpenAI 전사 후 저장·반환.

    채점 화면이 진입 시 별도로 호출 (메인 데이터와 분리하여 lazy 로드).
    첫 회만 느리고(수십 초~분), 이후엔 즉시 반환.
    """
    return await handle_ensure_transcript(ctx.institution_id, examination_id, uow)


@router.get("/audio-url", response_model=AudioUrlResponse)
async def get_audio_url(
    examination_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """오디오 재생용 presigned URL — 1시간 유효. 프론트 audio 태그가 직접 가져감."""
    return await handle_get_audio_url(ctx.institution_id, examination_id, uow)


# === Phase 3: 채점 / 검토 / 확정 ===

@router.get("/detail", response_model=SessionDetailResponse)
async def get_session_detail(
    examination_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_get_session_detail(ctx.institution_id, examination_id, uow)


@router.post("/score", response_model=SessionDetailResponse)
async def score_session(
    examination_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_score_session(ctx, examination_id, uow)


@router.post("/responses/{response_id}/score", response_model=ResponseDetail)
async def score_response(
    examination_id: str,
    response_id: str,
    body: ScoreResponseRequest = ScoreResponseRequest(),
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """단일 반응 AI 채점 — 채점 단위는 반응이다(§7 관계 역전)."""
    return await handle_score_response(
        ctx.institution_id, examination_id, response_id, body.transcript_text, uow
    )


@router.patch("/responses/{response_id}/coding", response_model=ResponseDetail)
async def update_response_coding(
    examination_id: str,
    response_id: str,
    data: CodingUpdateRequest,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_update_response_coding(
        ctx, examination_id, response_id, data, uow,
    )


@router.post("/confirm", response_model=SessionDetailResponse)
async def confirm_session(
    examination_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_confirm_session(
        ctx, examination_id, ctx.member_id, uow,
    )


# === Phase 4-1: 구조요약 ===

@router.get("/structural-summary", response_model=StructuralSummaryResponse)
async def get_structural_summary(
    examination_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_get_structural_summary(ctx.institution_id, examination_id, uow)


@router.get("/report/pdf")
async def generate_report_pdf(
    examination_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """로르샤하 보고서 PDF 생성 및 다운로드"""
    pdf_bytes = await handle_generate_report_pdf(ctx, examination_id, uow)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="rorschach_report_{examination_id[:8]}.pdf"'},
    )
