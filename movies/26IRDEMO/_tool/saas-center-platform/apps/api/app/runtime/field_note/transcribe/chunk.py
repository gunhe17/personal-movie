# 청크별 실시간 STT — 업로드 직후 whisper 빠른 전사(녹음 중 미리보기용). 녹음 완료 후 파이프라인과 별개.
from app.core.logger import get_logger
from app.infrastructure.stt.common.hallucination_filter import is_hallucination
from app.modules.field_note.facade import FieldNoteAudioTranscriptStatus
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext

from ..runner import PipelineRunner

logger = get_logger(__name__)


async def transcribe_chunk(
    runner: PipelineRunner,
    ai: AIFacade,
    storage,
    *,
    audio_id: str,
    storage_path: str,
    center_id: str,
    field_note_id: str,
    member_id: str | None = None,
) -> None:
    await runner.set_audio_status(
        audio_id,
        FieldNoteAudioTranscriptStatus.PROCESSING,
        center_id=center_id,
        actor_id=member_id,
    )

    audio_data = await storage.download_file(storage_path)
    if not audio_data:
        await runner.set_audio_status(
            audio_id,
            FieldNoteAudioTranscriptStatus.FAILED,
            center_id=center_id,
            actor_id=member_id,
        )
        return

    ctx = AICallContext(
        center_id=center_id,
        source_type="field_note",
        source_id=field_note_id,
        purpose=AIPurpose.FIELD_NOTE_STT_CHUNK,
        pipeline_step="stt_transcribe",
        member_id=member_id,
    )
    result = await ai.transcribe(ctx, audio_data)

    # hallucination 필터링 — 무음 구간에서 prompt 자체가 반복 출력되는 leakage 등을 제거.
    # 빈 문자열로 저장하면 모바일이 "조용한 구간이에요" placeholder 로 표시.
    text = result.text
    if is_hallucination(text):
        logger.info(
            f"Chunk STT hallucination filtered: audio_id={audio_id}, text={text[:80]!r}"
        )
        text = ""

    await runner.set_audio_transcript(
        audio_id,
        text,
        result.model,
        center_id=center_id,
        actor_id=member_id,
    )
    logger.info(f"Chunk STT completed: audio_id={audio_id}, text_length={len(text)}")
