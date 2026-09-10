"""field_extract — 유닛 빌드(이미지 전용/하이브리드 분기·캡·스탬프·팩 v4.1 프롬프트)·조립 결정론 (LLM 없음)."""
from __future__ import annotations

import io

import fitz

from app.runtime.voucher_document.batch_unit import UnitResult
from app.runtime.voucher_document.markdown_to_voucher.field_extract import (
    FIELD_GROUPS,
    MAX_IMAGES,
    assemble_field_results,
    build_field_units,
    normalize_fields,
    overflow_pages,
    span_ints,
    split_span_pages,
)
from app.runtime.voucher_document.processing_spec import FIELD_PACK


def _pdf(n: int) -> bytes:
    doc = fitz.open()
    for _ in range(n):
        doc.new_page(width=300, height=300)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


PAGES = {i: f"페이지 {i} 본문" for i in range(1, 21)}


def test_pack_v41_shape():
    # 21축 · 항목/사업유형 소멸 · bool 판정 자리 0 (사용자 결정 + E33/E38)
    assert len(FIELD_PACK["fields"]) == 21
    assert "항목" not in FIELD_PACK["fields"] and "사업유형" not in FIELD_PACK["fields"]
    assert set(FIELD_PACK["cell_fields"]) == {"목적", "소득기준", "연령기준", "처리통지", "이의신청", "환수"}
    assert sorted(k for keys in FIELD_GROUPS.values() for k in keys) == sorted(FIELD_PACK["fields"])


def test_units_nine_groups_hybrid_when_span_exceeds_cap():
    spans = [{"name": "A", "start_page": "p-001", "end_page": "p-020"}, {"name": "B", "start_page": 3, "end_page": 4}]
    units = build_field_units(pdf_bytes=_pdf(20), pages=PAGES, spans=spans, table_pages=set(range(1, 21)))
    assert [u.key for u in units] == [f"{i}:{g}" for i in (0, 1) for g in FIELD_GROUPS]   # 바우처당 9그룹
    content0 = units[0].messages[1]["content"]
    assert sum(1 for c in content0 if c["type"] == "image_url") == MAX_IMAGES          # 20p 구간 → 캡 12장
    assert content0[-1]["type"] == "text" and "<voucher_text>" in content0[-1]["text"]  # 초과 구간 = 하이브리드
    sys0 = units[0].messages[0]["content"]
    assert "텍스트층" in sys0 and '"목적"' in sys0 and '"사업유형"' not in sys0        # g1 축만 + 하이브리드 프롬프트
    g3 = next(u for u in units if u.key == "0:g3")
    assert '"지역"' in g3.messages[0]["content"]
    g4 = next(u for u in units if u.key == "0:g4")
    assert '"금액"' in g4.messages[0]["content"] and '"지역"' not in g4.messages[0]["content"]


def test_units_image_only_when_span_fits_cap():
    spans = [{"name": "B", "start_page": 3, "end_page": 4}]
    units = build_field_units(pdf_bytes=_pdf(20), pages=PAGES, spans=spans, table_pages={5})
    content = units[0].messages[1]["content"]
    assert sum(1 for c in content if c["type"] == "image_url") == 2                    # ≤캡 → 전 쪽 이미지
    assert "<voucher_text>" not in content[-1]["text"]                                 # 텍스트 없음 (E30)
    sysmsg = units[0].messages[0]["content"]
    assert "이미지뿐이다" in sysmsg and "p-NNN 스탬프" in sysmsg
    assert FIELD_PACK["관점"].splitlines()[0] in sysmsg                                # 의도 서술 관점


def test_fewshot_examples_in_system():
    spans = [{"name": "B", "start_page": 3, "end_page": 4}]
    units = build_field_units(pdf_bytes=_pdf(20), pages=PAGES, spans=spans, table_pages={5})
    g3 = next(u for u in units if u.key.endswith(":g3")).messages[0]["content"]
    assert "판별 예" in g3 and "✗" in g3 and "○" in g3                                  # 퓨샷 ○/✗ 대조쌍 (E38)


def test_scan_route_uses_all_span_pages_when_table_pages_none():
    spans = [{"name": "A", "start_page": 2, "end_page": 4}]
    units = build_field_units(pdf_bytes=_pdf(5), pages=PAGES, spans=spans, table_pages=None)
    content = units[0].messages[1]["content"]
    assert sum(1 for c in content if c["type"] == "image_url") == 3
    assert "<voucher_text>" in content[-1]["text"]                                     # 스캔 = 하이브리드 유지


def test_normalize_clamps_and_nulls():
    raw = {"목적": {"value": "null", "page": "p-003", "quote": "null"},
           "근근거법령": {"value": "오타 키"},
           "지역": {"지역들": [], "page": "p-004", "quote": "…"},
           "금액": [{"명칭": "가격"}]}
    out = normalize_fields(raw)
    assert set(out) == set(FIELD_PACK["fields"]) and "근근거법령" not in out            # 클램프
    assert out["목적"]["value"] is None                                                # "null" → 기권
    assert out["소득기준"] == {"value": None, "page": None, "quote": None}              # 누락 셀 → 명시적 null
    assert out["금액"] == [{"명칭": "가격"}] and out["욕구기준"] is None
    assert normalize_fields(None) is None


def test_assemble_partial_failures():
    spans = [{"name": "A"}, {"name": "B"}, {"name": "C"}]
    results = {
        "0:g1": UnitResult(ok=True, content='{"목적": {"value": "지원", "page": "p-001", "quote": "q"}}'),
        "0:g2": UnitResult(ok=False, error="timeout"),                                   # 일부 그룹 실패 → 축 null
        "0:g3": UnitResult(ok=True, content='{"지역": {"지역들": [{"이름": "수원시", "mark": "○"}]}}'),
        "0:g4": UnitResult(ok=True, content='{"금액": []}'),
        "1:g1": UnitResult(ok=False, error="timeout"),
        "2:g1": UnitResult(ok=True, content="not json"),
    }
    extracted, failures = assemble_field_results(results, spans)
    assert list(extracted) == [0] and extracted[0]["목적"]["value"] == "지원"
    assert extracted[0]["욕구기준"] is None and extracted[0]["지역"]["지역들"][0]["이름"] == "수원시"
    assert failures == [(1, "timeout"), (2, "invalid json (g1)")]


def test_span_ints_accepts_both_notations():
    assert span_ints(("p-081", "p-093")) == (81, 93) and span_ints((81, 93)) == (81, 93)


def test_split_span_pages_rule():
    T = {2, 5, 9, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24}
    assert split_span_pages(3, 4, T) == ([3, 4], [])                                  # |S|≤12 → 전 쪽, 전사 없음
    assert split_span_pages(1, 12, set()) == (list(range(1, 13)), [])
    img, gem = split_span_pages(1, 24, T)                                            # |S|>12 → T 페이지 순 12장, 나머지 전사
    assert img == [2, 5, 9, 14, 15, 16, 17, 18, 19, 20, 21, 22] and gem == [23, 24]
    assert split_span_pages(1, 30, None) == (list(range(1, 13)), [])                 # 스캔 경로
    spans = [{"start_page": 1, "end_page": 24}, {"start_page": "p-020", "end_page": "p-040"}]
    assert overflow_pages(spans, T) == [23, 24] and overflow_pages(spans, None) == []
