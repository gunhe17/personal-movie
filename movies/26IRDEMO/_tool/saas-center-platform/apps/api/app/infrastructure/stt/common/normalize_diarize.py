"""화자분리 전사 응답 정규화 서비스

OpenAI diarized_json 응답을 통일된 형식으로 변환합니다.
"""
from app.core.logger import get_logger

from .hallucination_filter import filter_hallucinated_segments

logger = get_logger(__name__)


def _apply_hallucination_filter(result: dict) -> dict:
    """정규화된 result 의 segments 에서 hallucination 제거."""
    segments = result.get("segments") or []
    if not segments:
        return result
    filtered, removed = filter_hallucinated_segments(segments)
    if removed > 0:
        logger.info(f"Hallucination filter removed {removed} segment(s)")
    result["segments"] = filtered
    return result


def normalize_diarize_response(raw: dict) -> dict:
    """
    OpenAI diarized_json 응답을 통일된 형식으로 변환.

    모두 → {"text": "...", "segments": [{"speaker", "text", "start", "end"}]} 로 정규화
    """
    if not isinstance(raw, dict):
        return {"text": "", "segments": []}

    full_text = raw.get("text", "") or ""
    segments_raw = raw.get("segments")

    # 디버깅: 실제 응답 구조 로깅
    seg_len = len(segments_raw) if isinstance(segments_raw, list) else "N/A"
    first_seg_info = "N/A"
    if isinstance(segments_raw, list) and len(segments_raw) > 0:
        first = segments_raw[0]
        if isinstance(first, dict):
            first_seg_info = f"keys={list(first.keys())}"
        else:
            first_seg_info = f"type={type(first).__name__}"
    logger.info(
        f"Normalize diarize: top_keys={list(raw.keys())}, "
        f"text_len={len(full_text)}, segments_len={seg_len}, "
        f"first_seg=[{first_seg_info}]"
    )

    # Case 1: segments 리스트 처리
    if isinstance(segments_raw, list) and segments_raw and isinstance(segments_raw[0], dict):
        first = segments_raw[0]

        # 1a: text 필드가 있는 세그먼트 → 직접 정규화
        if "text" in first:
            normalized = [
                {
                    "speaker": seg.get("speaker", seg.get("speaker_id", "A")),
                    "text": seg.get("text", ""),
                    "start": float(seg.get("start", 0.0)),
                    "end": float(seg.get("end", 0.0)),
                }
                for seg in segments_raw
                if isinstance(seg, dict)
            ]
            if normalized:
                return _apply_hallucination_filter({"text": full_text, "segments": normalized})

        # 1b: word-level 세그먼트 → 화자별 그룹핑
        if "word" in first:
            segments = _group_words_by_speaker(segments_raw)
            if segments:
                return _apply_hallucination_filter({"text": full_text, "segments": segments})

    # Case 2: speakers 기반 형식 (그룹화된 응답)
    speakers_raw = raw.get("speakers")
    if isinstance(speakers_raw, list) and len(speakers_raw) > 0:
        segments = []
        for speaker_group in speakers_raw:
            if not isinstance(speaker_group, dict):
                continue
            speaker_id = speaker_group.get("id", speaker_group.get("speaker", "?"))
            for utt in speaker_group.get("utterances", []):
                segments.append({
                    "speaker": speaker_id,
                    "text": utt.get("text", ""),
                    "start": float(utt.get("start", 0.0)),
                    "end": float(utt.get("end", 0.0)),
                })
        if segments:
            segments.sort(key=lambda s: s["start"])
            return _apply_hallucination_filter({"text": full_text, "segments": segments})

    # Case 3: words 기반 형식
    words_raw = raw.get("words")
    if isinstance(words_raw, list) and len(words_raw) > 0:
        segments = _group_words_by_speaker(words_raw)
        if segments:
            return _apply_hallucination_filter({"text": full_text, "segments": segments})

    # Fallback: text만 있으면 단일 세그먼트로 생성
    if full_text.strip():
        logger.info(f"Diarize fallback: using full text as single segment (len={len(full_text)})")
        return {
            "text": full_text,
            "segments": [{"speaker": "A", "text": full_text, "start": 0.0, "end": 0.0}],
        }

    logger.warning(
        f"Empty diarize response: keys={list(raw.keys())}, "
        f"text_len={len(full_text)}, segments_len={seg_len}"
    )
    return {"text": "", "segments": []}


def _group_words_by_speaker(words: list) -> list[dict]:
    """word-level 리스트를 speaker별 연속 그룹으로 합침"""
    segments = []
    current_speaker = None
    current_words: list[str] = []
    current_start = 0.0

    for w in words:
        if not isinstance(w, dict):
            continue
        speaker = w.get("speaker", "A")
        word = w.get("word", w.get("text", ""))
        if speaker != current_speaker:
            if current_words and current_speaker:
                segments.append({
                    "speaker": current_speaker,
                    "text": " ".join(current_words),
                    "start": current_start,
                    "end": float(w.get("start", 0.0)),
                })
            current_speaker = speaker
            current_words = [word]
            current_start = float(w.get("start", 0.0))
        else:
            current_words.append(word)

    if current_words and current_speaker:
        segments.append({
            "speaker": current_speaker,
            "text": " ".join(current_words),
            "start": current_start,
            "end": float(words[-1].get("end", 0.0)) if isinstance(words[-1], dict) else 0.0,
        })

    return segments
