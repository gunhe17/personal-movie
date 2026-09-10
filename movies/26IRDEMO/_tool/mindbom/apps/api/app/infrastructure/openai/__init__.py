"""OpenAI 음성 전사 (whisper-1 + gpt-4o-transcribe-diarize)"""
import base64
from functools import lru_cache
from typing import Any

from openai import AsyncOpenAI
from pydantic import BaseModel

from app.core.config import settings


class Transcript(BaseModel):
    """단순 전사 결과 (whisper-1)"""
    text: str
    language: str | None = None
    duration_sec: float | None = None


class Segment(BaseModel):
    """화자 분리 세그먼트"""
    speaker: str
    start: float
    end: float
    text: str


class DiarizedTranscript(BaseModel):
    """화자 분리 전사 결과 (gpt-4o-transcribe-diarize)"""
    text: str
    segments: list[Segment]
    duration_sec: float | None = None


class OpenAITranscription:
    """OpenAI Audio API 클라이언트 (스트리밍 미사용)"""

    def __init__(self, api_key: str, timeout: float = 120.0):
        self._client = AsyncOpenAI(api_key=api_key, timeout=timeout)

    async def whisper(
        self,
        audio: bytes,
        *,
        filename: str = "audio.wav",
        language: str | None = None,
        prompt: str | None = None,
    ) -> Transcript:
        """whisper-1 전사 (verbose_json으로 duration 회수)"""
        params: dict[str, Any] = {
            "model": "whisper-1",
            "file": (filename, audio),
            "response_format": "verbose_json",
        }
        if language:
            params["language"] = language
        if prompt:
            params["prompt"] = prompt

        resp = await self._client.audio.transcriptions.create(**params)
        return Transcript(
            text=getattr(resp, "text", "") or "",
            language=getattr(resp, "language", None),
            duration_sec=getattr(resp, "duration", None),
        )

    async def diarize(
        self,
        audio: bytes,
        *,
        filename: str = "audio.wav",
        language: str | None = None,
        known_speakers: dict[str, bytes] | None = None,
        speaker_mime: str = "audio/wav",
    ) -> DiarizedTranscript:
        """gpt-4o-transcribe-diarize 화자 분리 전사.

        Args:
            known_speakers: {화자라벨: 2~10초 참조 오디오}, 최대 4명
            speaker_mime: 참조 오디오 MIME 타입 (모든 참조에 공통 적용)
        """
        params: dict[str, Any] = {
            "model": "gpt-4o-transcribe-diarize",
            "file": (filename, audio),
            "response_format": "diarized_json",
            "chunking_strategy": "auto",
        }
        if language:
            params["language"] = language
        if known_speakers:
            if len(known_speakers) > 4:
                raise ValueError("known_speakers는 최대 4명까지 지원됩니다.")
            params["extra_body"] = {
                "known_speaker_names": list(known_speakers.keys()),
                "known_speaker_references": [
                    f"data:{speaker_mime};base64,{base64.b64encode(ref).decode('ascii')}"
                    for ref in known_speakers.values()
                ],
            }

        resp = await self._client.audio.transcriptions.create(**params)
        segments = [
            Segment(
                speaker=str(getattr(s, "speaker", "unknown")),
                start=float(getattr(s, "start", 0.0) or 0.0),
                end=float(getattr(s, "end", 0.0) or 0.0),
                text=str(getattr(s, "text", "") or ""),
            )
            for s in (getattr(resp, "segments", []) or [])
        ]
        return DiarizedTranscript(
            text=getattr(resp, "text", "") or " ".join(s.text for s in segments),
            segments=segments,
            duration_sec=getattr(resp, "duration", None),
        )


@lru_cache
def get_transcription() -> OpenAITranscription:
    return OpenAITranscription(api_key=settings.OPENAI_API_KEY)


__all__ = [
    "DiarizedTranscript",
    "OpenAITranscription",
    "Segment",
    "Transcript",
    "get_transcription",
]
