import json

from ...field_note_audio.models import FieldNoteAudio


# 규약: 각 청크의 diarized_transcript 는 "그 청크에서 시작한 세션"의 상대시간 세그먼트.
# 전체 전사 = chunk_index 순으로 선행 청크 duration 누적을 오프셋으로 더해 이어붙인다(모바일 buildTimeline 동일).
# 멀티파트 스트리밍은 첫 파트에 세션 전체 전사가 실리고 뒤 파트는 오프셋만 보탠다.
def merge_chunk_transcripts(audios: list[FieldNoteAudio]) -> dict:
    segments: list[dict] = []
    offset = 0.0
    for a in sorted(audios, key=lambda x: x.chunk_index):
        if a.diarized_transcript:
            try:
                parsed = json.loads(a.diarized_transcript)
                for s in parsed.get("segments") or []:
                    segments.append({
                        "speaker": s.get("speaker", "A"),
                        "text": s.get("text", ""),
                        "start": float(s.get("start", 0.0) or 0.0) + offset,
                        "end": float(s.get("end", 0.0) or 0.0) + offset,
                    })
            except (ValueError, TypeError):
                pass
        offset += a.duration or 0.0
    text = " ".join(s["text"].strip() for s in segments if s.get("text", "").strip())
    return {"text": text, "segments": segments}
