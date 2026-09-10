import json


# 타임스탬프 그라운딩용 (start_sec, text) 목록 — build_transcript_text 와 동일 소스 우선순위, 포맷팅 없이 원문만.
class BuildTranscriptSegmentsService:
    def execute(self, field_note, audios) -> list[tuple[float, str]]:
        if field_note.refined_transcript:
            try:
                segs: list[tuple[float, str]] = []
                for seg in json.loads(field_note.refined_transcript):
                    txt = (seg.get("text") or "").strip()
                    if txt:
                        segs.append((float(seg.get("start", 0) or 0), txt))
                if segs:
                    return segs
            except (json.JSONDecodeError, TypeError):
                pass

        if audios:
            try:
                segs = []
                offset = 0.0
                for audio in sorted(audios, key=lambda a: a.chunk_index):
                    if audio.diarized_transcript:
                        raw = json.loads(audio.diarized_transcript)
                        for seg in raw.get("segments", []):
                            txt = (seg.get("text") or "").strip()
                            if txt:
                                segs.append((float(seg.get("start", 0) or 0) + offset, txt))
                    offset += audio.duration or 0.0
                if segs:
                    return segs
            except (json.JSONDecodeError, TypeError):
                pass

        segs = []
        for audio in audios:
            if audio.transcript:
                segs.append((float(audio.chunk_index * 15), audio.transcript.strip()))
        return segs
