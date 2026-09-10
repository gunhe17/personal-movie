"""지원금(support_amount) 구조화 dict → 표시용 문자열 포매터.

저장형은 자유 schema dict (voucher.support_amount, JSONB):
    {"통화": "KRW",
     "원문": "월 18만원~25만원",            # 파이프라인이 넣은 원문 (있을 때만)
     "월총액": {"최소": 180000, "최대": 250000} | 250000,
     "정부지원금": ..., "본인부담금": ...,
     "가격탄력제": true,
     "등급별": [{"등급":1,"기준":"...","정부지원금":...,"본인부담금":...}, ...]}

센터/내담자 응답은 이 dict를 그대로 노출하되, 프론트가 바로 표시할 수 있도록
`support_amount_text` 파생 문자열을 함께 제공한다 (이 모듈의 format_support_amount).
"""
from __future__ import annotations


def _fmt_amount(amt: object) -> str | None:
    """금액(단일 number 또는 {최소,최대}) → '180,000원' / '180,000~250,000원'."""
    if isinstance(amt, bool):
        return None
    if isinstance(amt, (int, float)):
        return f"{int(amt):,}원"
    if isinstance(amt, dict):
        lo = amt.get("최소")
        hi = amt.get("최대")
        lo_ok = isinstance(lo, (int, float)) and not isinstance(lo, bool)
        hi_ok = isinstance(hi, (int, float)) and not isinstance(hi, bool)
        if lo_ok and hi_ok:
            if int(lo) == int(hi):
                return f"{int(lo):,}원"
            return f"{int(lo):,}~{int(hi):,}원"
        if hi_ok:
            return f"{int(hi):,}원"
        if lo_ok:
            return f"{int(lo):,}원"
    return None


def format_support_amount(value: object) -> str | None:
    """구조화 지원금 dict → 사람이 읽을 수 있는 한 줄 요약. 없으면 None.

    우선순위:
      1. 원문(문자열)이 있으면 그대로
      2. 월총액 → "월 {금액}"
      3. 정부지원금 → "정부지원 {금액}"
      4. 등급별만 있으면 "등급별 {N}단계"
    """
    if not isinstance(value, dict):
        return None

    raw = value.get("원문")
    if isinstance(raw, str) and raw.strip():
        # 원문이 여러 줄(등급 상세 등)이면 첫 줄만 — 표시용 한 줄 요약
        return raw.strip().split("\n", 1)[0].strip()

    monthly = _fmt_amount(value.get("월총액"))
    if monthly:
        suffix = " (가격탄력제)" if value.get("가격탄력제") else ""
        return f"월 {monthly}{suffix}"

    gov = _fmt_amount(value.get("정부지원금"))
    if gov:
        return f"정부지원 {gov}"

    grades = value.get("등급별")
    if isinstance(grades, list) and len(grades) > 0:
        return f"등급별 {len(grades)}단계"

    return None
