from __future__ import annotations

import asyncio

from app.core.logger import get_logger
from app.infrastructure.stt.common.base import STTProvider
from app.infrastructure.stt.common.exception import STTConfigError, STTProviderError
from app.infrastructure.stt.common.schemas import SpeakerSegment, TranscriptSegment

logger = get_logger(__name__)


class PyAnnoteDiarizationClient(STTProvider):
    def __init__(self, hf_token: str | None = None):
        self.hf_token = hf_token
        self._model_id = "pyannote/speaker-diarization-3.1"

    async def diarize(
        self,
        audio_data: bytes,
        *,
        num_speakers: int | None = None,
        language: str = "ko",
    ) -> list[SpeakerSegment]:
        if not self.hf_token:
            raise STTConfigError(
                "HuggingFace token이 설정되지 않았습니다. "
                "HUGGINGFACE_TOKEN 환경변수를 설정하세요."
            )

        import httpx

        url = f"https://api-inference.huggingface.co/models/{self._model_id}"
        headers = {"Authorization": f"Bearer {self.hf_token}"}

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, content=audio_data)

            if response.status_code == 503:
                logger.info("pyannote model loading, waiting 30s...")
                await asyncio.sleep(30)
                response = await client.post(url, headers=headers, content=audio_data)

            if response.status_code >= 400:
                raise STTProviderError(
                    f"pyannote diarization error {response.status_code}: {response.text[:500]}"
                )

            result = response.json()

        segments: list[SpeakerSegment] = []
        speaker_map: dict[str, str] = {}
        speaker_counter = 0

        for item in result:
            raw_label = item.get("label", "SPEAKER_00")
            if raw_label not in speaker_map:
                speaker_map[raw_label] = chr(ord("A") + speaker_counter)
                speaker_counter += 1
            segments.append(SpeakerSegment(
                speaker=speaker_map[raw_label],
                start=item.get("start", 0.0),
                end=item.get("end", 0.0),
            ))

        logger.info(
            f"pyannote diarization done: {len(segments)} segments, "
            f"{len(speaker_map)} speakers detected"
        )
        return segments


def align_transcript_with_speakers(
    transcript_segments: list[TranscriptSegment],
    speaker_segments: list[SpeakerSegment],
) -> list[dict]:
    if not transcript_segments:
        return []

    if not speaker_segments:
        return [
            {"speaker": "A", "text": seg.text, "start": seg.start, "end": seg.end}
            for seg in transcript_segments
        ]

    aligned: list[dict] = []
    for tseg in transcript_segments:
        midpoint = (tseg.start + tseg.end) / 2

        best_speaker = "A"
        best_overlap = 0.0
        for sseg in speaker_segments:
            overlap_start = max(tseg.start, sseg.start)
            overlap_end = min(tseg.end, sseg.end)
            overlap = max(0.0, overlap_end - overlap_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = sseg.speaker

        if best_overlap == 0.0:
            min_dist = float("inf")
            for sseg in speaker_segments:
                dist = min(abs(midpoint - sseg.start), abs(midpoint - sseg.end))
                if dist < min_dist:
                    min_dist = dist
                    best_speaker = sseg.speaker

        aligned.append({
            "speaker": best_speaker,
            "text": tseg.text,
            "start": tseg.start,
            "end": tseg.end,
        })

    return aligned
