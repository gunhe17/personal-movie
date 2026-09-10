from __future__ import annotations

from typing import AsyncIterator, Protocol

from app.infrastructure.stt.common.schemas import STTResponse, SpeakerSegment


class StreamingSTTSession(Protocol):
    async def feed_audio(self, data: bytes) -> None: ...
    def get_responses(self) -> AsyncIterator[STTResponse]: ...
    async def pause(self) -> None: ...
    async def resume(self) -> None: ...
    async def finish(self) -> list[STTResponse]: ...
    async def close(self) -> None: ...


class STTProvider:
    async def transcribe(
        self, audio_data: bytes, language: str = "ko", filename: str = "audio.webm",
    ) -> str:
        raise NotImplementedError

    async def transcribe_with_timestamps(
        self, audio_data: bytes, language: str = "ko", filename: str = "audio.webm",
        model_override: str | None = None,
    ) -> dict:
        raise NotImplementedError

    async def transcribe_with_diarization(
        self, audio_data: bytes, language: str = "ko", model_override: str | None = None,
        filename: str = "audio.webm", known_duration: float = 0,
    ) -> dict:
        raise NotImplementedError

    async def diarize(
        self, audio_data: bytes, *, num_speakers: int | None = None, language: str = "ko",
    ) -> list[SpeakerSegment]:
        raise NotImplementedError

    async def create_session(
        self, language_code: str = "ko-KR", sample_rate: int = 16000,
    ) -> StreamingSTTSession:
        raise NotImplementedError
