import json

from ...field_note_audio.repository import FieldNoteAudioRepository
from app.infrastructure.stt.common.normalize_diarize import normalize_diarize_response


class ListRefineSegmentsService:
    def __init__(
        self,
        audio_repo: FieldNoteAudioRepository,
    ):
        self.repo = audio_repo

    async def execute(
        self,
        field_note_id: str,
    ) -> list[dict]:
        # load
        audios = await self.repo.list_by_field_note(field_note_id)

        # compute
        segments: list[dict] = []
        offset = 0.0
        fallback_text = ""
        for audio in sorted(audios, key=lambda a: a.chunk_index):
            if audio.diarized_transcript:
                try:
                    raw = json.loads(audio.diarized_transcript)
                except (ValueError, TypeError):
                    raw = None
                if raw is not None:
                    normalized = normalize_diarize_response(raw)
                    chunk_segments = normalized.get("segments", []) or []
                    for s in chunk_segments:
                        segments.append({
                            **s,
                            "start": float(s.get("start", 0.0) or 0.0) + offset,
                            "end": float(s.get("end", 0.0) or 0.0) + offset,
                        })
                    if not chunk_segments and normalized.get("text"):
                        fallback_text += (" " if fallback_text else "") + normalized["text"]
            offset += audio.duration or 0.0

        # verify
        if not segments:
            if fallback_text:
                segments = [{"speaker": "A", "text": fallback_text, "start": 0.0, "end": 0.0}]
            else:
                raise RuntimeError("No transcription segments to refine")

        # return
        return segments
