"""LLM 요약 응답 파싱 — 구조화 분석 JSON 해석 + 인용 타임스탬프 보정(순수 로직)."""
import json


def parse_analysis(content: str, max_seconds: float | None = None) -> tuple[str, str | None]:
    """LLM JSON 응답 → (summary_text, analysis_json).

    구조화 파싱에 실패하거나 의미 있는 필드가 없으면 content 를 평문 요약으로
    간주하고 analysis_json=None 을 반환(기존 평문 동작으로 안전 폴백).

    max_seconds: 녹음 총 길이(초). 주어지면 모든 타임스탬프 t 를 [0, max_seconds]
        로 클램프 — LLM 이 회기 길이를 넘는 시각을 지어내는(과추정) 것을 방어.
    """
    try:
        data = json.loads(content)
        if not isinstance(data, dict):
            raise ValueError("not a json object")
    except (json.JSONDecodeError, TypeError, ValueError):
        return content.strip(), None

    def _to_seconds(v) -> float:
        if isinstance(v, (int, float)):
            raw = float(v)
        elif isinstance(v, str):
            try:
                sec = 0
                for part in v.strip().split(":"):
                    sec = sec * 60 + int(part)
                raw = float(sec)
            except ValueError:
                raw = 0.0
        else:
            raw = 0.0
        if raw < 0:
            raw = 0.0
        # 녹음 길이를 넘는 과추정 시각은 끝으로 클램프 (재생·표시 깨짐 방지).
        if max_seconds is not None and raw > max_seconds:
            raw = float(max_seconds)
        return raw

    def _str_list(key: str) -> list[str]:
        v = data.get(key)
        if not isinstance(v, list):
            return []
        return [str(x).strip() for x in v if str(x).strip()]

    def _ts_text_list(key: str) -> list[dict]:
        """[{t, text}] 리스트 파싱 (highlights/observations/quotes 공용)."""
        out: list[dict] = []
        raw = data.get(key)
        if isinstance(raw, list):
            for h in raw:
                if isinstance(h, dict) and str(h.get("text", "")).strip():
                    out.append({"t": _to_seconds(h.get("t", 0)), "text": str(h["text"]).strip()})
        return out

    def _responses_list() -> list[dict]:
        """검사 렌즈 — [{t, prompt, response}] 파싱."""
        out: list[dict] = []
        raw = data.get("responses")
        if isinstance(raw, list):
            for r in raw:
                if not isinstance(r, dict):
                    continue
                prompt = str(r.get("prompt", "")).strip()
                response = str(r.get("response", "")).strip()
                if prompt or response:
                    out.append({"t": _to_seconds(r.get("t", 0)), "prompt": prompt, "response": response})
        return out

    def _mood_flow_list() -> list[dict]:
        """상담 렌즈 — [{t, mood, trigger}] 시점별 정서 흐름 파싱."""
        out: list[dict] = []
        raw = data.get("mood_flow")
        if isinstance(raw, list):
            for m in raw:
                if not isinstance(m, dict):
                    continue
                mood_v = str(m.get("mood", "")).strip()
                if not mood_v:
                    continue
                out.append({
                    "t": _to_seconds(m.get("t", 0)),
                    "mood": mood_v,
                    "trigger": str(m.get("trigger", "")).strip(),
                })
        return out

    def _key_quotes_list() -> list[dict]:
        """상담 렌즈 — [{t, quote, note}] 의미 있는 발화 파싱."""
        out: list[dict] = []
        raw = data.get("key_quotes")
        if isinstance(raw, list):
            for q in raw:
                if not isinstance(q, dict):
                    continue
                quote_v = str(q.get("quote", "")).strip()
                if not quote_v:
                    continue
                out.append({
                    "t": _to_seconds(q.get("t", 0)),
                    "quote": quote_v,
                    "note": str(q.get("note", "")).strip(),
                })
        return out

    def _follow_ups_list() -> list[dict]:
        """상담 렌즈 — [{point, reason}] 살펴볼 지점 파싱."""
        out: list[dict] = []
        raw = data.get("follow_ups")
        if isinstance(raw, list):
            for f in raw:
                if not isinstance(f, dict):
                    continue
                point_v = str(f.get("point", "")).strip()
                if not point_v:
                    continue
                out.append({
                    "point": point_v,
                    "reason": str(f.get("reason", "")).strip(),
                })
        return out

    highlights = _ts_text_list("highlights")

    # 목록 식별용 짧은 제목 (15자 내외 요청, 과도 길이 방어 절단)
    title = str(data.get("title") or "").strip()[:30] or None

    summary_text = str(data.get("summary") or "").strip()
    narrative = str(data.get("narrative") or "").strip() or None
    mood = data.get("mood")
    mood = mood.strip() if isinstance(mood, str) and mood.strip() else None

    # 상담 렌즈 필드 + 검사 렌즈 필드를 함께 보관(데이터 있는 쪽만 채워짐).
    # 프런트는 §3-4-1/§3-4-3 따라 "데이터 있는 섹션만" 렌더.
    keywords = _str_list("keywords")
    issues = _str_list("issues")
    mood_flow = _mood_flow_list()
    key_quotes = _key_quotes_list()
    follow_ups = _follow_ups_list()
    responses = _responses_list()
    observations = _ts_text_list("observations")
    quotes = _ts_text_list("quotes")

    normalized = {
        "title": title,
        "summary": summary_text,
        "narrative": narrative,
        "keywords": keywords,
        "issues": issues,
        "mood": mood,
        "mood_flow": mood_flow,
        "key_quotes": key_quotes,
        "follow_ups": follow_ups,
        "highlights": highlights,
        "responses": responses,
        "observations": observations,
        "quotes": quotes,
    }

    # 의미 있는 구조화 필드가 전혀 없으면 평문으로 폴백.
    if not (summary_text or narrative or keywords or issues or mood
            or mood_flow or key_quotes or follow_ups
            or highlights or responses or observations or quotes):
        return content.strip(), None

    return summary_text, json.dumps(normalized, ensure_ascii=False)


def ground_quote_timestamps(analysis: dict, segments: list[tuple[float, str]]) -> dict:
    """key_quotes 의 t 를 전사에서 실제 발화 위치로 보정.

    LLM 이 긴 회기에서 인용문 타임스탬프를 과추정/오추정하는 것을 방어한다.
    인용문(verbatim)을 정규화해 전사 세그먼트와 매칭, 매칭되면 그 세그먼트 start 로 교체.
    매칭 실패 시 기존(클램프된) t 유지.
    """
    import re

    quotes = analysis.get("key_quotes")
    if not isinstance(quotes, list) or not segments:
        return analysis

    def _norm(s: str) -> str:
        return re.sub(r"[^0-9a-z가-힣]", "", str(s).lower())

    nsegs = [(start, _norm(text)) for start, text in segments]

    for q in quotes:
        if not isinstance(q, dict):
            continue
        nq = _norm(q.get("quote", ""))
        if len(nq) < 5:
            continue
        best_start: float | None = None
        best_score = 0
        for start, ns in nsegs:
            if not ns:
                continue
            # 인용문이 세그먼트에 통째로 들어있거나(가장 강함),
            # 세그먼트가 인용문의 일부(LLM 이 여러 발화를 이어붙인 경우)
            if nq in ns:
                score = len(nq)
            elif ns in nq:
                score = len(ns)
            else:
                continue
            if score > best_score:
                best_score = score
                best_start = start
        # 인용문 길이의 절반 이상(최소 8자) 겹쳐야 신뢰
        if best_start is not None and best_score >= max(8, len(nq) // 2):
            q["t"] = round(float(best_start), 2)
    return analysis
