import json
from dataclasses import dataclass

from app.core.exceptions import InvalidOperationException
from ..repository import FieldNoteRepository


@dataclass
class ExportResult:
    content: str
    format: str
    filename: str


class ExportTranscriptService:
    def __init__(self, note_repo: FieldNoteRepository):
        self._note_repo = note_repo

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
        *,
        format: str,
        fallback_segments: list[dict] | None = None,
    ) -> ExportResult:
        # load
        field_note = await self._note_repo.get_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )

        if field_note.transcribe_status != "completed":
            raise InvalidOperationException("전사가 완료된 필드노트만 내보낼 수 있습니다.")

        segments = self._load_segments(field_note)
        if not segments and fallback_segments:
            segments = fallback_segments

        speaker_map = {}
        if field_note.speaker_map:
            try:
                speaker_map = json.loads(field_note.speaker_map)
            except (json.JSONDecodeError, TypeError):
                pass

        if format == "json":
            content = self._to_json(segments, speaker_map)
        else:
            content = self._to_text(segments, speaker_map)

        filename = f"transcript_{field_note_id[:8]}.{'json' if format == 'json' else 'txt'}"
        return ExportResult(content=content, format=format, filename=filename)

    def _load_segments(self, field_note) -> list[dict]:
        if field_note.refined_transcript:
            try:
                return json.loads(field_note.refined_transcript)
            except (json.JSONDecodeError, TypeError):
                pass
        return []

    def _resolve_speaker(self, speaker: str, speaker_map: dict[str, str]) -> str:
        return speaker_map.get(speaker, f"화자 {speaker}")

    def _to_text(self, segments: list[dict], speaker_map: dict[str, str]) -> str:
        lines = []
        for seg in segments:
            speaker = self._resolve_speaker(seg.get("speaker", "?"), speaker_map)
            text = seg.get("text", "")
            start = seg.get("start", 0)
            m, s = divmod(int(start), 60)
            lines.append(f"[{m:02d}:{s:02d}] {speaker}: {text}")
        return "\n".join(lines) if lines else "(전사 내용 없음)"

    def _to_json(self, segments: list[dict], speaker_map: dict[str, str]) -> str:
        export_segments = []
        for seg in segments:
            export_segments.append({
                "speaker": self._resolve_speaker(seg.get("speaker", "?"), speaker_map),
                "text": seg.get("text", ""),
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
            })
        return json.dumps(export_segments, ensure_ascii=False, indent=2)
