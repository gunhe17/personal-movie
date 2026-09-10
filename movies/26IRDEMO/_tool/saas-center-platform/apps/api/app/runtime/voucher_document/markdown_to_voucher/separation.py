"""S2a — 바우처 분리 (통합 MD 전체 → 개별 바우처 span + 공용 구간).

lab 검증 구성: 통합 MD 전체를 한 호출로 — 퓨샷 없음, temperature 1.0,
maxOutputTokens 16000. 프롬프트는 processing_spec verbatim.
"""
from __future__ import annotations

from app.infrastructure.llm.openrouter.chat_json import parse_json_lenient
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult
from app.runtime.voucher_document.processing_spec import (
    S2A_MAX_TOKENS,
    S2A_SYSTEM,
    S2A_TASK,
    TEMPERATURE,
)

from .schemas import CommonSpan, VoucherSpan
from app.runtime.voucher_document.common.page_markdown import page_num

_KEY = "separate"


def build_separation_unit(
    *,
    model: str,
    full_doc: str,
) -> BatchUnit:
    return BatchUnit(
        key=_KEY,
        model=model,
        messages=[
            {"role": "system", "content": S2A_SYSTEM},
            {"role": "user", "content": S2A_TASK.format(document=full_doc)},
        ],
        max_tokens=S2A_MAX_TOKENS,
        response_format={"type": "json_object"},
        temperature=TEMPERATURE,
    )


def parse_separation_result(
    result: UnitResult,
) -> tuple[list[VoucherSpan], list[CommonSpan]]:
    """`run_stage()`(모드 무관)가 돌려준 결과 → (span 리스트, 공용 구간 리스트). 실패 시 빈 리스트들."""
    data = parse_json_lenient(result.content)[0] if (result.ok and result.content) else None
    if not isinstance(data, dict):
        return [], []

    spans = [
        s for s in
        (_parse_span(rv) for rv in (data.get("vouchers") or []))
        if s is not None
    ]
    commons = [
        c for c in
        (_parse_common(rc) for rc in (data.get("common") or []))
        if c is not None
    ]
    return spans, commons


def _parse_span(raw: dict) -> VoucherSpan | None:
    if not isinstance(raw, dict):
        return None
    name = str(raw.get("name") or "").strip()
    start, end = raw.get("start_page"), raw.get("end_page")
    # name 과 해석 가능한 페이지 범위는 필수 — 없으면 슬라이스 불가
    if not name or page_num(start) is None or page_num(end) is None:
        return None
    code = str(raw["code"]).strip() if raw.get("code") else None
    indicators = [
        str(x) for x in raw.get("indicators") or [] if isinstance(x, str)
    ]
    return VoucherSpan(
        no=str(raw.get("no") or "").strip(),
        name=name,
        code=code,
        start_page=str(start),
        end_page=str(end),
        indicators=indicators,
        rationale=str(raw.get("rationale") or "").strip(),
    )


def _parse_common(raw: dict) -> CommonSpan | None:
    if not isinstance(raw, dict):
        return None
    start, end = raw.get("start_page"), raw.get("end_page")
    if page_num(start) is None or page_num(end) is None:
        return None
    return CommonSpan(
        label=str(raw.get("label") or "").strip(),
        start_page=str(start),
        end_page=str(end),
    )
