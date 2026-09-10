"""전사 Services — OpenAI 인프라 호출 + 도메인 매핑"""
from app.infrastructure.openai import OpenAITranscription
from app.modules.transcription.schemas import (
    DiarizeResponse,
    SpeakerSegment,
    TranscribeResponse,
)


class WhisperService:
    """whisper-1 단순 전사"""

    def __init__(self, client: OpenAITranscription):
        self._client = client

    async def execute(
        self,
        audio: bytes,
        *,
        filename: str = "audio.wav",
        language: str | None = None,
        prompt: str | None = None,
    ) -> TranscribeResponse:
        result = await self._client.whisper(
            audio, filename=filename, language=language, prompt=prompt,
        )
        return TranscribeResponse(
            text=result.text,
            language=result.language,
            duration_sec=result.duration_sec,
        )


class DiarizeService:
    """gpt-4o-transcribe-diarize 화자 분리 전사"""

    def __init__(self, client: OpenAITranscription):
        self._client = client

    async def execute(
        self,
        audio: bytes,
        *,
        filename: str = "audio.wav",
        language: str | None = None,
        known_speakers: dict[str, bytes] | None = None,
        speaker_mime: str = "audio/wav",
    ) -> DiarizeResponse:
        result = await self._client.diarize(
            audio,
            filename=filename,
            language=language,
            known_speakers=known_speakers,
            speaker_mime=speaker_mime,
        )
        return DiarizeResponse(
            text=result.text,
            segments=[
                SpeakerSegment(
                    speaker=s.speaker, start=s.start, end=s.end, text=s.text,
                )
                for s in result.segments
            ],
            duration_sec=result.duration_sec,
        )
