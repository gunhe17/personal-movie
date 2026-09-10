"""AWS Transcribe 배치 전사 — lab/비실시간용 transport.

프로덕션 공유 세션(AWSTranscribeSession)은 실시간 녹음용이라 finish()에 10초 강제
취소가 있어 긴 파일 배치가 잘린다. 여기서는 SDK를 직접 구동해 전체 PCM 전송 후
출력 스트림이 닫힐 때까지 끝까지 수집한다(취소 없음).
"""
import asyncio
import os
import tempfile

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


async def batch_transcribe_segments(
    audio_bytes: bytes,
    filename: str,
) -> list[dict]:
    """AWS Transcribe 배치: 파일 전 구간을 스트리밍으로 전사 → 타임스탬프 세그먼트.

    반환: [{"text", "start", "end"}] (final 결과만, 화자 라벨 없음).

    ⚠️ 프로덕션 공유 클라이언트(AWSTranscribeSession)는 실시간 녹음용이라 finish()에
    10초 강제 취소가 있어, 긴 파일을 배치로 몰아넣으면 처음 ~10초 처리분만 남고 잘린다.
    lab 배치는 무음 재연결도 불필요하므로 여기서 SDK를 직접 구동한다:
    전체 PCM 전송 → end_stream → 출력 스트림이 닫힐 때까지 결과를 끝까지 수집(취소 없음).
    파일을 끊김 없이 연속 전송하므로 AWS 타임스탬프가 파일 시작 기준으로 연속이다.
    """
    # 설정/자격증명 검증은 공유 factory 재사용 (객체는 쓰지 않음)
    from app.infrastructure.stt.factory import get_streaming_provider

    if not get_streaming_provider():
        raise RuntimeError(
            "AWS Transcribe를 사용할 수 없습니다. "
            "STT_STREAMING_PROVIDER=aws_transcribe 설정과 AWS 인증 정보를 확인하세요."
        )

    from amazon_transcribe.client import TranscribeStreamingClient
    from amazon_transcribe.auth import StaticCredentialResolver
    from amazon_transcribe.handlers import TranscriptResultStreamHandler
    from amazon_transcribe.model import TranscriptEvent

    # 오디오 → PCM 16kHz mono 변환 (ffmpeg)
    pcm_data = await _convert_to_pcm(audio_bytes, filename)

    client = TranscribeStreamingClient(
        region=settings.AWS_REGION,
        credential_resolver=StaticCredentialResolver(
            access_key_id=settings.AWS_ACCESS_KEY_ID,
            secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        ),
    )
    stream = await client.start_stream_transcription(
        language_code=settings.AWS_TRANSCRIBE_LANGUAGE_CODE,
        media_sample_rate_hz=16000,
        media_encoding="pcm",
        enable_partial_results_stabilization=True,
        partial_results_stability="medium",
    )

    finals: list[dict] = []

    class _Handler(TranscriptResultStreamHandler):
        async def handle_transcript_event(self_h, event: TranscriptEvent):
            for result in event.transcript.results:
                # 안정화된 final 결과만 수집 (partial 은 중복/임시이므로 제외)
                if result.is_partial or not result.alternatives:
                    continue
                text = (result.alternatives[0].transcript or "").strip()
                if not text:
                    continue
                finals.append({
                    "text": text,
                    "start": float(result.start_time) if result.start_time is not None else 0.0,
                    "end": float(result.end_time) if result.end_time is not None else 0.0,
                })

    async def _write_audio():
        chunk_size = 32000  # 1초 분량
        for i in range(0, len(pcm_data), chunk_size):
            await stream.input_stream.send_audio_event(audio_chunk=pcm_data[i:i + chunk_size])
            await asyncio.sleep(0)  # 핸들러가 중간 결과를 소비하도록 양보
        await stream.input_stream.end_stream()

    handler = _Handler(stream.output_stream)
    # end_stream 후 AWS 가 출력 스트림을 닫을 때까지 끝까지 수집 (10초 취소 없음 → 잘리지 않음)
    await asyncio.gather(_write_audio(), handler.handle_events())

    finals.sort(key=lambda s: s["start"])
    logger.info(f"AWS batch transcribe done: {len(finals)} final segments")
    return finals



async def _convert_to_pcm(audio_bytes: bytes, filename: str) -> bytes:
    """ffmpeg으로 오디오를 PCM 16kHz mono 16bit로 변환."""
    ext = os.path.splitext(filename)[1] or ".bin"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as src:
        src.write(audio_bytes)
        src_path = src.name

    dst_path = src_path + ".pcm"
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", src_path,
            "-ar", "16000", "-ac", "1", "-f", "s16le", dst_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"PCM 변환 실패: {stderr.decode()[:500]}")

        with open(dst_path, "rb") as f:
            return f.read()
    finally:
        for p in (src_path, dst_path):
            try:
                os.unlink(p)
            except OSError:
                pass

