def merge_segments_by_gap(segments: list[dict], gap_seconds: float) -> list[dict]:
    if gap_seconds <= 0 or not segments:
        return [{"text": (s.get("text") or "").strip(),
                 "start": float(s.get("start", 0.0) or 0.0),
                 "end": float(s.get("end", 0.0) or 0.0)}
                for s in segments if (s.get("text") or "").strip()]

    segs = sorted(segments, key=lambda s: float(s.get("start", 0.0) or 0.0))
    merged: list[dict] = []
    for s in segs:
        text = (s.get("text") or "").strip()
        if not text:
            continue
        start = float(s.get("start", 0.0) or 0.0)
        end = float(s.get("end", 0.0) or 0.0)
        if end < start:
            end = start
        if merged and (start - merged[-1]["end"]) < gap_seconds:
            merged[-1]["text"] = f"{merged[-1]['text']} {text}".strip()
            merged[-1]["end"] = max(merged[-1]["end"], end)
        else:
            merged.append({"text": text, "start": start, "end": end})
    return merged
