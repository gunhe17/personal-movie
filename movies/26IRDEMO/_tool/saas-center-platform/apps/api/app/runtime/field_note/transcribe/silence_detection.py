"""침묵 감지 서비스

pydub 오디오 에너지(RMS) 기반으로 연속 저에너지 구간(침묵)을 감지합니다.
ML 모델 불필요 — 에너지 임계값 방식.
"""
import io

from app.core.logger import get_logger

logger = get_logger(__name__)


def detect_silence_markers(
    audio_bytes: bytes,
    *,
    silence_thresh_dbfs: float = -40.0,
    min_silence_duration_ms: int = 3000,
    frame_ms: int = 100,
) -> list[dict]:
    try:
        from pydub import AudioSegment

        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        total_ms = len(audio)

        markers: list[dict] = []
        silence_start_ms: int | None = None

        for offset_ms in range(0, total_ms, frame_ms):
            frame = audio[offset_ms : offset_ms + frame_ms]
            is_silent = frame.dBFS < silence_thresh_dbfs

            if is_silent:
                if silence_start_ms is None:
                    silence_start_ms = offset_ms
            else:
                if silence_start_ms is not None:
                    duration_ms = offset_ms - silence_start_ms
                    if duration_ms >= min_silence_duration_ms:
                        markers.append({
                            "type": "silence",
                            "start": round(silence_start_ms / 1000.0, 1),
                            "end": round(offset_ms / 1000.0, 1),
                            "duration": round(duration_ms / 1000.0, 1),
                        })
                    silence_start_ms = None

        # 오디오 끝까지 침묵이 이어진 경우
        if silence_start_ms is not None:
            duration_ms = total_ms - silence_start_ms
            if duration_ms >= min_silence_duration_ms:
                markers.append({
                    "type": "silence",
                    "start": round(silence_start_ms / 1000.0, 1),
                    "end": round(total_ms / 1000.0, 1),
                    "duration": round(duration_ms / 1000.0, 1),
                })

        logger.info(f"Silence detection: {len(markers)} markers found in {total_ms / 1000:.1f}s audio")
        return markers

    except Exception as e:
        logger.warning(f"Silence detection failed (non-fatal): {e}")
        return []
