"""repair.py — 분쟁 셀만 유닛화 · 재채점 통과분만 교체 (lab E21 계약, LLM 없음)."""
from __future__ import annotations

import io

import fitz

from app.runtime.voucher_document.batch_unit import UnitResult
from app.runtime.voucher_document.markdown_to_voucher.repair import (
    apply_repair_results,
    build_repair_units,
)
from app.runtime.voucher_document.markdown_to_voucher.verification import page_texts
from app.runtime.voucher_document.processing_spec import MODEL_ARBITER, REPAIR_MAX_PER_VOUCHER


def _pdf(*texts: str) -> bytes:
    doc = fitz.open()
    for t in texts:
        doc.new_page(width=400, height=300).insert_text((30, 40), t, fontsize=10, fontname="korea")
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


PDF = _pdf("지원금액 장애인의료비 본인부담금 전액", "연령기준 18세 미만 등록장애인")
PAGES = {1: "지원금액 장애인의료비 본인부담금 전액", 2: "연령기준 18세 미만 등록장애인"}
FIELD_DEFS = {"지원금액": "금액 원문", "연령기준": "연령 요건", "목적": "목적 절"}


def _voucher():
    return {
        "name": "장애인 의료비 지원", "span": [1, 2],
        "fields": {
            "지원금액": {"value": "엉뚱한 값", "page": "p-001", "quote": ""},
            "연령기준": {"value": "18세 미만", "page": "p-002", "quote": ""},
            "목적": {"value": None, "page": None, "quote": None},
        },
        "verify": {"지원금액": "미확인", "연령기준": "확인", "목적": "기권"},
    }


def test_units_only_for_dispute_grades_and_capped():
    v = _voucher()
    v["verify"].update({f"x{i}": "출처불량" for i in range(5)})
    units = build_repair_units(pages=PAGES, vouchers=[v], field_defs=FIELD_DEFS)
    keys = {u.key for u in units}
    assert "0:지원금액" in keys and "0:연령기준" not in keys and "0:목적" not in keys
    assert len(units) == REPAIR_MAX_PER_VOUCHER
    assert all(u.model == MODEL_ARBITER for u in units)
    assert '"지원금액"' in units[0].messages[0]["content"] and "<!-- ═══════════ p-001" in units[0].messages[1]["content"]


def test_accepts_only_when_regrade_passes():
    v = _voucher()
    texts = page_texts(PDF)
    results = {
        "0:지원금액": UnitResult(ok=True, content='{"지원금액": {"value": "장애인의료비 본인부담금", "page": "p-001", "quote": "본인부담금"}}'),
    }
    logs = apply_repair_results([v], results, texts)
    assert v["verify"]["지원금액"] == "확인" and v["fields"]["지원금액"]["repaired"] is True
    assert logs == ["장애인 의료비 지원·지원금액: 미확인→확인"]


def test_keeps_original_when_regrade_fails_or_call_fails():
    v = _voucher()
    texts = page_texts(PDF)
    results = {
        "0:지원금액": UnitResult(ok=True, content='{"지원금액": {"value": "여전히 없는 값", "page": "p-001", "quote": ""}}'),
    }
    apply_repair_results([v], results, texts)
    assert v["verify"]["지원금액"] == "미확인" and "repaired" not in v["fields"]["지원금액"]
    logs = apply_repair_results([v], {"0:지원금액": UnitResult(ok=False, error="boom")}, texts)
    assert logs[0].endswith("유지(재추출 실패)")


def test_null_string_becomes_honest_abstain():
    v = _voucher()
    texts = page_texts(PDF)
    results = {"0:지원금액": UnitResult(ok=True, content='{"지원금액": {"value": "null", "page": "p-001", "quote": "null"}}')}
    apply_repair_results([v], results, texts)
    assert v["verify"]["지원금액"] == "기권" and v["fields"]["지원금액"]["value"] is None
