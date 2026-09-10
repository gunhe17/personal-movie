import asyncio
import io
import os

from openai import AsyncOpenAI

from app.core.logger import get_logger
from app.infrastructure.stt.common.base import STTProvider
from app.infrastructure.stt.whisper.audio import (
    DEFAULT_MAX_DURATION,
    DIARIZE_CHUNK_SECONDS,
    MODEL_MAX_DURATION,
    get_duration,
    split_audio,
    to_mp3,
)
from app.infrastructure.stt.whisper.hallucination import is_ko_hallucination
from app.infrastructure.stt.whisper.prompts import (
    KO_DOMAIN_PROMPT_FULL,
    KO_DOMAIN_PROMPT_LITE,
)
from app.infrastructure.stt.whisper.retry import call_with_retry

logger = get_logger(__name__)

_DIARIZE_MAX_CONCURRENCY = int(os.getenv("STT_DIARIZE_MAX_CONCURRENCY", "6"))


def _reconcile_speakers(segments: list[dict], chunk_ranges: list[tuple[int, int]]) -> None:
    for start, end in chunk_ranges:
        chunk = segments[start:end]
        if not chunk:
            continue
        totals: dict[str, int] = {}
        for s in chunk:
            sp = s.get("speaker", "A")
            totals[sp] = totals.get(sp, 0) + len(s.get("text", ""))
        ranked = sorted(totals, key=lambda sp: -totals[sp])
        if len(ranked) < 2 or ranked[0] == "A":
            continue
        swap = {ranked[0]: "A", ranked[1]: "B"}
        for s in chunk:
            s["speaker"] = swap.get(s["speaker"], s["speaker"])


class WhisperSTTClient(STTProvider):
    def __init__(
        self,
        api_key: str,
        model: str = "whisper-1",
        diarize_model: str = "gpt-4o-transcribe-diarize",
    ):
        self.api_key = api_key
        self.model = model
        self.diarize_model = diarize_model
        # 로컬 촬영에서는 base_url로 대역을 끼운다(`_scripts/llm-stub.mjs`) — 비어 있으면 공식 API 그대로다.
        # 시뮬레이터에는 사람의 말이 없으므로 진짜 Whisper를 부를 이유가 없다(촬영 규칙 5와 같은 원칙).
        from app.core.config import settings as _settings

        _base = getattr(_settings, "OPENAI_BASE_URL", "") or None
        self._client = AsyncOpenAI(api_key=api_key, base_url=_base)

    @staticmethod
    def _is_gpt4o_model(model: str) -> bool:
        return "gpt-4o" in model and "transcribe" in model

    async def _transcribe_single(
        self, mp3_data: bytes, language: str, chunk_label: str = "",
    ) -> str:
        use_json = self._is_gpt4o_model(self.model)

        def _build_request():
            audio_file = io.BytesIO(mp3_data)
            audio_file.name = "audio.mp3"
            transcribe_kwargs: dict = {
                "model": self.model,
                "file": audio_file,
                "language": language,
                "response_format": "json" if use_json else "text",
                "temperature": 0,
            }
            if language == "ko":
                transcribe_kwargs["prompt"] = KO_DOMAIN_PROMPT_LITE
            return self._client.audio.transcriptions.create(**transcribe_kwargs)

        transcript = await call_with_retry(
            _build_request, label=f"transcribe{f' {chunk_label}' if chunk_label else ''}"
        )

        if use_json:
            result = (transcript.text or "").strip()
        else:
            result = transcript.strip() if isinstance(transcript, str) else str(transcript).strip()

        if chunk_label:
            logger.info(f"STT chunk {chunk_label} done: {len(result)} chars")
        return result

    async def transcribe(
        self,
        audio_data: bytes,
        language: str = "ko",
        filename: str = "audio.webm",
    ) -> str:
        mp3_data = await to_mp3(audio_data, filename)

        logger.info(
            f"STT request: model={self.model}, filename={filename}, "
            f"original_size={len(audio_data)}, mp3_size={len(mp3_data)}"
        )

        max_dur = MODEL_MAX_DURATION.get(self.model, DEFAULT_MAX_DURATION)
        chunks = await split_audio(mp3_data, max_dur)

        if len(chunks) == 1:
            return await self._transcribe_single(chunks[0], language)

        results: list[str] = []
        for i, chunk in enumerate(chunks):
            text = await self._transcribe_single(
                chunk, language, chunk_label=f"{i+1}/{len(chunks)}"
            )
            results.append(text)

        return " ".join(results)

    async def transcribe_with_timestamps(
        self,
        audio_data: bytes,
        language: str = "ko",
        filename: str = "audio.webm",
        model_override: str | None = None,
    ) -> dict:
        mp3_data = await to_mp3(audio_data, filename)
        model = model_override or self.model

        logger.info(
            f"STT timestamps request: model={model}, filename={filename}, "
            f"original_size={len(audio_data)}, mp3_size={len(mp3_data)}"
        )

        max_dur = MODEL_MAX_DURATION.get(model, DEFAULT_MAX_DURATION)
        chunks = await split_audio(mp3_data, max_dur)

        all_segments: list[dict] = []
        all_texts: list[str] = []
        time_offset = 0.0

        for i, chunk in enumerate(chunks):
            def _build_request(chunk=chunk):
                audio_file = io.BytesIO(chunk)
                audio_file.name = "audio.mp3"
                kwargs: dict = {
                    "model": model,
                    "file": audio_file,
                    "language": language,
                    "response_format": "verbose_json",
                    "timestamp_granularities": ["segment"],
                    "temperature": 0,
                }
                if language == "ko":
                    kwargs["prompt"] = KO_DOMAIN_PROMPT_FULL
                return self._client.audio.transcriptions.create(**kwargs)

            transcript = await call_with_retry(
                _build_request, label=f"timestamps chunk {i+1}/{len(chunks)}"
            )

            text = (transcript.text or "").strip()
            all_texts.append(text)

            for seg in transcript.segments or []:
                all_segments.append({
                    "text": seg.text.strip() if hasattr(seg, "text") else str(seg.get("text", "")).strip(),
                    "start": (seg.start if hasattr(seg, "start") else seg.get("start", 0)) + time_offset,
                    "end": (seg.end if hasattr(seg, "end") else seg.get("end", 0)) + time_offset,
                })

            chunk_duration = await get_duration(chunk)
            time_offset += chunk_duration if chunk_duration else max_dur

            if len(chunks) > 1:
                logger.info(f"STT timestamps chunk {i+1}/{len(chunks)} done: {len(text)} chars")

        return {"text": " ".join(all_texts), "segments": all_segments}

    async def transcribe_with_diarization(
        self,
        audio_data: bytes,
        language: str = "ko",
        model_override: str | None = None,
        filename: str = "audio.webm",
        known_duration: float = 0,
    ) -> dict:
        model = model_override or self.diarize_model
        mp3_data = await to_mp3(audio_data, filename)

        logger.info(
            f"STT diarization request: model={model}, filename={filename}, "
            f"original_size={len(audio_data)}, mp3_size={len(mp3_data)}, "
            f"known_duration={known_duration:.0f}s"
        )

        chunks = await split_audio(
            mp3_data, DIARIZE_CHUNK_SECONDS, known_duration=known_duration,
        )

        logger.info(
            f"STT diarization split result: {len(chunks)} chunks "
            f"(chunk_seconds={DIARIZE_CHUNK_SECONDS}, "
            f"total_bytes={len(mp3_data)}, known_duration={known_duration:.0f}s)"
        )

        chunk_durations: list[float] = []
        for chunk in chunks:
            dur = await get_duration(chunk)
            chunk_durations.append(dur if dur > 0 else DIARIZE_CHUNK_SECONDS)

        async def _call_chunk(chunk: bytes, label: str = "") -> list[dict]:
            if label:
                logger.info(f"STT diarization {label}")

            def _build_request():
                audio_file = io.BytesIO(chunk)
                audio_file.name = "audio.mp3"
                kwargs: dict = {
                    "file": audio_file,
                    "model": model,
                    "language": language,
                    "response_format": "diarized_json",
                    "chunking_strategy": "auto",
                    "temperature": 0,
                }
                return self._client.audio.transcriptions.create(**kwargs)

            transcript = await call_with_retry(
                _build_request, label=f"diarization {label}" if label else "diarization"
            )

            if hasattr(transcript, "segments"):
                return [
                    {
                        "speaker": getattr(s, "speaker", "A"),
                        "text": getattr(s, "text", ""),
                        "start": getattr(s, "start", 0),
                        "end": getattr(s, "end", 0),
                    }
                    for s in (transcript.segments or [])
                ]
            elif isinstance(transcript, dict):
                return transcript.get("segments", [])
            return []

        def _is_truncated(segments: list[dict], expected_duration: float) -> bool:
            if not segments or not expected_duration:
                return False
            last_end = max(s.get("end", 0) for s in segments)
            return last_end < expected_duration * 0.8

        _sem = asyncio.Semaphore(_DIARIZE_MAX_CONCURRENCY)

        async def _call_chunk_limited(chunk: bytes, label: str) -> list[dict]:
            async with _sem:
                return await _call_chunk(chunk, label)

        if len(chunks) > _DIARIZE_MAX_CONCURRENCY:
            logger.info(
                f"STT diarization: {len(chunks)} chunks, "
                f"concurrency limited to {_DIARIZE_MAX_CONCURRENCY}"
            )
        chunk_results = await asyncio.gather(
            *[_call_chunk_limited(chunk, f"chunk {i+1}/{len(chunks)}") for i, chunk in enumerate(chunks)]
        )

        _MIN_RETRY_CHUNK = 30
        for i, chunk_segments in enumerate(chunk_results):
            if not _is_truncated(chunk_segments, chunk_durations[i]):
                continue
            if chunk_durations[i] < _MIN_RETRY_CHUNK:
                continue

            logger.warning(
                f"STT truncation in chunk {i+1}/{len(chunks)}: "
                f"coverage={max(s.get('end', 0) for s in chunk_segments):.1f}s/"
                f"{chunk_durations[i]:.1f}s — retrying with smaller chunks"
            )
            half = int(chunk_durations[i] / 2)
            sub_chunks = await split_audio(chunks[i], half)
            sub_results: list[dict] = []
            sub_offset = 0.0
            for j, sc in enumerate(sub_chunks):
                sc_dur = await get_duration(sc)
                sc_dur = sc_dur if sc_dur > 0 else half
                segs = await _call_chunk(sc, f"retry chunk {i+1}.{j+1}")
                for s in segs:
                    s["start"] = s.get("start", 0) + sub_offset
                    s["end"] = s.get("end", 0) + sub_offset
                sub_results.extend(segs)
                sub_offset += sc_dur
            chunk_results[i] = sub_results
            chunk_durations[i] = sub_offset

        all_segments: list[dict] = []
        chunk_ranges: list[tuple[int, int]] = []
        time_offset = 0.0

        for i, chunk_segments in enumerate(chunk_results):
            start_idx = len(all_segments)

            for seg in chunk_segments:
                seg["start"] = seg.get("start", 0) + time_offset
                seg["end"] = seg.get("end", 0) + time_offset
                all_segments.append(seg)

            chunk_ranges.append((start_idx, len(all_segments)))
            time_offset += chunk_durations[i]

        if len(chunks) > 1:
            _reconcile_speakers(all_segments, chunk_ranges)

        if language == "ko":
            before = len(all_segments)
            all_segments = [
                s for s in all_segments if not is_ko_hallucination(s.get("text", ""))
            ]
            removed = before - len(all_segments)
            if removed:
                logger.info(f"Removed {removed} hallucination segments")

        text = " ".join(s.get("text", "") for s in all_segments)
        return {"text": text, "segments": all_segments}
