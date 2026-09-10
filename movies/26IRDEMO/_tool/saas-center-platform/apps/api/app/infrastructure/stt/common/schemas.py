from dataclasses import dataclass


@dataclass
class STTResponse:
    text: str
    is_final: bool
    start_seconds: float | None = None
    end_seconds: float | None = None
    stability: float = 0.0
    is_error: bool = False


class SpeakerSegment:
    __slots__ = ("speaker", "start", "end")

    def __init__(self, speaker: str, start: float, end: float):
        self.speaker = speaker
        self.start = start
        self.end = end

    def to_dict(self) -> dict:
        return {"speaker": self.speaker, "start": self.start, "end": self.end}


class TranscriptSegment:
    __slots__ = ("text", "start", "end")

    def __init__(self, text: str, start: float, end: float):
        self.text = text
        self.start = start
        self.end = end
