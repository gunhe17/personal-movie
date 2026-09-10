import json


# 소스 우선순위: refined_transcript → diarized_transcript(청크 누적 오프셋, merge_chunk_transcripts 규약) → chunk transcript.
class BuildTranscriptTextService:
    def execute(self, field_note, audios) -> str:
        markers = _parse_silence_markers(field_note)

        if field_note.refined_transcript:
            try:
                segments = json.loads(field_note.refined_transcript)
                lines_ts: list[tuple[float, str]] = []
                for seg in segments:
                    speaker = seg.get("speaker", "?")
                    text = seg.get("text", "")
                    start = seg.get("start", 0)
                    m, s = divmod(int(start), 60)
                    lines_ts.append((start, f"[{m:02d}:{s:02d}] 화자 {speaker}: {text}"))
                if lines_ts:
                    return "\n".join(_interleave_silence(lines_ts, markers))
            except (json.JSONDecodeError, TypeError):
                pass

        if audios:
            try:
                lines_ts = []
                offset = 0.0
                for audio in sorted(audios, key=lambda a: a.chunk_index):
                    if audio.diarized_transcript:
                        raw = json.loads(audio.diarized_transcript)
                        for seg in raw.get("segments", []):
                            speaker = seg.get("speaker", "?")
                            text = seg.get("text", "")
                            start = float(seg.get("start", 0) or 0) + offset
                            m, s = divmod(int(start), 60)
                            lines_ts.append((start, f"[{m:02d}:{s:02d}] 화자 {speaker}: {text}"))
                    offset += audio.duration or 0.0
                if lines_ts:
                    return "\n".join(_interleave_silence(lines_ts, markers))
            except (json.JSONDecodeError, TypeError):
                pass

        transcripts = []
        for audio in audios:
            if audio.transcript:
                start_sec = audio.chunk_index * 15
                minutes, seconds = divmod(int(start_sec), 60)
                transcripts.append(f"[{minutes:02d}:{seconds:02d}] {audio.transcript}")

        return "\n".join(transcripts) if transcripts else "(전사 내용 없음)"


def _parse_silence_markers(field_note) -> list[dict]:
    if not getattr(field_note, "nonverbal_markers", None):
        return []
    try:
        return json.loads(field_note.nonverbal_markers)
    except (json.JSONDecodeError, TypeError):
        return []


def _interleave_silence(lines_with_ts: list[tuple[float, str]], markers: list[dict]) -> list[str]:
    if not markers:
        return [line for _, line in lines_with_ts]

    items: list[tuple[float, str]] = list(lines_with_ts)
    for mk in markers:
        start = mk.get("start", 0)
        duration = mk.get("duration", 0)
        m, s = divmod(int(start), 60)
        items.append((start, f"[{m:02d}:{s:02d}] --- {duration:.1f}초 침묵 ---"))

    items.sort(key=lambda x: x[0])
    return [line for _, line in items]
