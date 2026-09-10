"""음성 전사 응답 스키마 (요청은 multipart/form-data로 라우터에서 직접 처리)"""
from pydantic import BaseModel


class TranscribeResponse(BaseModel):
    """단순 전사 결과 (whisper-1)"""
    text: str
    language: str | None = None
    duration_sec: float | None = None


class SpeakerSegment(BaseModel):
    """화자 분리 세그먼트"""
    speaker: str
    start: float
    end: float
    text: str


class DiarizeResponse(BaseModel):
    """화자 분리 전사 결과 (gpt-4o-transcribe-diarize)"""
    text: str
    segments: list[SpeakerSegment]
    duration_sec: float | None = None
