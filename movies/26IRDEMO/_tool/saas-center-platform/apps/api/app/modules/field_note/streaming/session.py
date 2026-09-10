import uuid
from datetime import datetime, timezone

from app.infrastructure.storage import get_storage_client
from app.core.logger import get_logger
from app.infrastructure.stt.common.schemas import STTResponse
from .wav_writer import pcm_to_wav

logger = get_logger(__name__)

# 10분마다 PCM 버퍼를 WAV로 flush (메모리 압박 방지)
# 16kHz 16bit mono: 1초 = 32KB, 10분 = ~19.2MB
_FLUSH_INTERVAL_SECONDS = 600
_PCM_BYTES_PER_SECOND = 32000  # 16kHz * 2 bytes (16bit)


class StreamingRecordingSession:
    def __init__(
        self,
        *,
        field_note_id: str,
        center_id: str,
        member_id: str,
        stt_session,
        sample_rate: int = 16000,
    ):
        self.field_note_id = field_note_id
        self.center_id = center_id
        self.member_id = member_id
        self.session_id = str(uuid.uuid4())
        self.sample_rate = sample_rate

        # 게이트웨이 StreamingTranscription — transport·quota·사용량 기록 소유
        self._stt_session = stt_session
        self._pcm_buffer = bytearray()
        self._wav_parts: list[dict] = []  # flushed WAV parts [{path, duration}]
        self._start_time = datetime.now(timezone.utc)
        self._total_pcm_bytes: int = 0
        self._closed = False
        # 라이브 전사 재사용: 흘러가는 final 결과를 누적 → 종료 시 field-note 전사로 저장.
        # (whisper 재전사를 생략하고 사용자가 녹음 중 본 자막을 그대로 최종 본문으로 사용)
        self._final_segments: list[dict] = []

    # final 만 전사 세그먼트로 누적 (오류·partial 제외)
    def _accumulate(self, response) -> None:
        if getattr(response, "is_error", False):
            return
        if not response.is_final:
            return
        text = (response.text or "").strip()
        if not text:
            return
        self._final_segments.append({
            "speaker": "A",  # 스트리밍 단계는 화자 미구분 (화자분리는 온디맨드 text-diarize)
            "text": text,
            "start": float(response.start_seconds) if response.start_seconds is not None else 0.0,
            "end": float(response.end_seconds) if response.end_seconds is not None else 0.0,
        })

    def build_transcript(self) -> dict | None:
        # 세그먼트가 없으면 None — whisper 폴백 전사를 그대로 두기 위함
        if not self._final_segments:
            return None
        segs = sorted(self._final_segments, key=lambda s: s["start"])
        text = " ".join(s["text"] for s in segs if s["text"])
        return {"text": text, "segments": segs}

    def get_parts(self) -> list[dict]:
        # 긴 녹음(>10분)은 10분마다 part로 쪼개짐 — 각 part를 별도 청크로 등록해야 오디오 무유실
        return list(self._wav_parts)

    @property
    def total_duration(self) -> float:
        return self._total_pcm_bytes / _PCM_BYTES_PER_SECOND

    async def start(self) -> None:
        logger.info(
            f"Streaming session started: session={self.session_id}, "
            f"field_note={self.field_note_id}"
        )

    async def feed_audio(self, data: bytes) -> None:
        if self._closed or not self._stt_session:
            return
        await self._stt_session.feed_audio(data)
        self._pcm_buffer.extend(data)
        self._total_pcm_bytes += len(data)

        buffer_seconds = len(self._pcm_buffer) / _PCM_BYTES_PER_SECOND
        if buffer_seconds >= _FLUSH_INTERVAL_SECONDS:
            await self._flush_buffer()

    async def get_responses(self):
        if self._stt_session:
            async for response in self._stt_session.get_responses():
                # 전사 누적은 라이브 자막(yield) 경로를 절대 깨면 안 됨 → 예외 격리
                try:
                    self._accumulate(response)
                except Exception as e:
                    logger.warning(f"Transcript accumulate skipped (non-fatal): {e}")
                yield response

    async def pause(self) -> None:
        if self._stt_session:
            await self._stt_session.pause()

    async def resume(self) -> None:
        if self._stt_session:
            await self._stt_session.resume()

    async def finish(self) -> dict:
        if self._closed:
            return {"audio_storage_path": "", "total_duration": self.total_duration}
        self._closed = True

        remaining: list[STTResponse] = []
        if self._stt_session:
            remaining = await self._stt_session.finish()
            await self._stt_session.close()
        # pump 가 미처 소비하지 못한 tail final 도 전사에 포함
        for r in remaining:
            self._accumulate(r)

        # 남은 PCM 버퍼 flush
        storage_path = await self._flush_buffer(final=True)

        logger.info(
            f"Streaming session finished: session={self.session_id}, "
            f"duration={self.total_duration:.1f}s, "
            f"path={storage_path}, parts={len(self._wav_parts)}"
        )

        return {
            "audio_storage_path": storage_path or "",
            "total_duration": self.total_duration,
        }

    # 사용량 기록 위임(멱등·non-fatal) — finish/비정상종료 경로에서만. 유령 세션 eviction은 기록 없이 close(기존 무과금 유지).
    async def record_stt_usage(self) -> None:
        try:
            await self._stt_session.record_usage()
        except Exception as e:
            logger.warning(f"Failed to record streaming STT usage: {e}")

    # 비정상 종료 시 보유 오디오 저장
    async def emergency_save(self) -> str | None:
        if not self._pcm_buffer and not self._wav_parts:
            return None
        self._closed = True
        if self._stt_session:
            try:
                await self._stt_session.close()
            except Exception:
                pass
        return await self._flush_buffer(final=True)

    async def _flush_buffer(self, *, final: bool = False) -> str | None:
        # final=True 최종 파일 / False 중간 flush(part 파일)
        if not self._pcm_buffer:
            # 최종 요청인데 이전 flush만 있는 경우 → 마지막 part 경로 반환
            return self._wav_parts[-1]["path"] if self._wav_parts and final else None

        pcm_data = bytes(self._pcm_buffer)
        self._pcm_buffer.clear()

        wav_data = pcm_to_wav(
            pcm_data,
            sample_rate=self.sample_rate,
            channels=1,
            bits_per_sample=16,
        )

        part_index = len(self._wav_parts)
        if final and part_index == 0:
            # 단일 파일 (flush 없이 종료)
            storage_path = (
                f"field-notes/{self.field_note_id}/audio/{self.session_id}.wav"
            )
        else:
            storage_path = (
                f"field-notes/{self.field_note_id}/audio/"
                f"{self.session_id}_part{part_index:03d}.wav"
            )

        storage_client = get_storage_client()
        await storage_client.upload_file(wav_data, storage_path, "audio/wav")
        self._wav_parts.append({
            "path": storage_path,
            "duration": len(pcm_data) / _PCM_BYTES_PER_SECOND,
        })

        logger.info(
            f"PCM buffer flushed: session={self.session_id}, "
            f"part={part_index}, size={len(wav_data)} bytes, "
            f"final={final}"
        )

        return storage_path


# 활성 세션 레지스트리 (member_id → session)
_active_sessions: dict[str, StreamingRecordingSession] = {}


def get_active_session(member_id: str) -> StreamingRecordingSession | None:
    return _active_sessions.get(member_id)


def register_session(member_id: str, session: StreamingRecordingSession) -> None:
    _active_sessions[member_id] = session


def unregister_session(
    member_id: str, session: "StreamingRecordingSession | None" = None
) -> None:
    # session이 주어지면 현재 등록 세션과 동일할 때만 제거(identity check) — 유령 세션 eviction 후
    # 뒤늦게 종료되는 옛 coroutine의 finally가 새 세션 등록을 지워버리지 않도록 보호.
    if session is None:
        _active_sessions.pop(member_id, None)
    elif _active_sessions.get(member_id) is session:
        _active_sessions.pop(member_id, None)
