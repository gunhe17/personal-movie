"""document_to_list — 결정론 부품 계약 (lab check.py·E20 이식, 합성 PDF, LLM 없음)."""
from __future__ import annotations

import io
from pathlib import Path

import fitz

from app.runtime.voucher_document.batch_unit import UnitResult
from app.runtime.voucher_document.document_to_list import (
    apply_arbiter_results,
    assemble_split,
    build_arbiter_units,
    build_split_units,
    classify_pdf_bytes,
    complement,
    parse_toc,
    reconcile_with_toc,
    scope_warning,
    text_pages_markdown,
    title_candidates,
)
from app.runtime.voucher_document.processing_spec import MODEL_ARBITER, MODEL_LIST

BODY = "본문 문장입니다 대상자는 등록장애인이며 신청은 읍면동에 합니다 " * 3
TITLES = ["2-1 장애인 자립생활 지원", "2-2 중증장애인 동료상담", "2-3 장애인 재활지원"]


def _doc() -> bytes:
    """p1 목차(인쇄쪽 = PDF쪽 − 1) · p2 개요 · p3~5 사업 3개(큰 제목 + 본문)."""
    doc = fitz.open()
    toc = doc.new_page(width=500, height=700)
    y = 60
    for i, t in enumerate(TITLES):
        toc.insert_text((40, y), t, fontsize=10, fontname="korea")
        toc.insert_text((420, y), str(2 + i), fontsize=10, fontname="korea")   # 인쇄쪽 2,3,4 → PDF 3,4,5
        y += 20
    intro = doc.new_page(width=500, height=700)
    intro.insert_text((40, 60), "제1장 사업 개요 " + BODY, fontsize=9, fontname="korea")
    for t in TITLES:
        pg = doc.new_page(width=500, height=700)
        pg.insert_text((40, 60), t, fontsize=18, fontname="korea")
        for k in range(6):
            pg.insert_text((40, 120 + k * 30), BODY, fontsize=9, fontname="korea")
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


PDF = _doc()


def test_classify_and_text_pages():
    pdf_type, n = classify_pdf_bytes(PDF)
    assert pdf_type == "text_based" and n == 5
    pages, _tables = text_pages_markdown(PDF)
    assert set(pages) == {1, 2, 3, 4, 5} and "자립생활" in pages[3]


SAMPLE = (Path(__file__).parent / "fixtures" / "sample_10p.pdf").read_bytes()   # 실제 공문서 10p (합성 PDF의
                                                                                   # 내장 CJK 폰트는 pdf-inspector 가 디코딩 못 함 — 실측)


def test_title_candidates_keep_big_headings_only():
    cands = title_candidates(SAMPLE)
    joined = "\n".join(cands)
    assert "아동정서발달지원서비스(031109)" in joined          # 사업 대제목(15pt, 6자리 코드 동반)
    assert "추천서" in joined and "소견서" in joined             # 20pt 서식 제목도 후보(판정은 LLM 몫)
    assert "서비스 대상" not in joined                           # 본문 9~10pt 는 후보 아님
    assert all(c.startswith("p") and "pt" in c for c in cands)
    pdf_type, n = classify_pdf_bytes(SAMPLE)
    assert pdf_type == "text_based" and n == 10


def test_split_units_k2_chunks_and_assemble_union_diff():
    cands = [f"p{i:>3}  18.0pt  제목{i}" for i in range(3)]
    units = build_split_units(cands)
    assert [u.key for u in units] == ["k0:c0", "k1:c0"] and all(u.model == MODEL_LIST for u in units)
    results = {
        "k0:c0": UnitResult(ok=True, content='{"vouchers":[{"name":"A","start_page":3},{"name":"B","start_page":4}],"commons":[{"label":"서식","start_page":6}]}'),
        "k1:c0": UnitResult(ok=True, content='{"vouchers":[{"name":"A","start_page":3},{"name":"C (130209)","start_page":5}],"commons":[]}'),
    }
    vs, diff = assemble_split(results, n_pages=7)
    assert [v["start_page"] for v in vs] == [3, 4, 5] and diff == [4, 5]      # 합집합 + 대칭차
    assert vs[0]["end_page"] == 3 and vs[1]["end_page"] == 4
    assert vs[2]["end_page"] == 5 and vs[2]["code"] == "130209"               # 트레일링 서식으로 닫힘 + code 방출


def test_toc_parse_and_reconcile_restores_missing_and_merges_oversplit():
    doc = fitz.open(stream=PDF, filetype="pdf")
    toc = parse_toc(doc)
    assert toc and [t[0] for t in toc] == ["2-1", "2-2", "2-3"] and toc[0][2] == 2
    vouchers = [
        {"name": "장애인 자립생활 지원", "start_page": 3, "end_page": 3},
        {"name": "완전히 다른 가짜 항목", "start_page": 4, "end_page": 4},       # 과분리 모사
        {"name": "장애인 재활지원", "start_page": 5, "end_page": 5},            # 2-2 누락 모사
    ]
    out, rep = reconcile_with_toc(doc, vouchers, 5)
    starts = [v["start_page"] for v in out]
    assert starts == [3, 4, 5] and out[1]["toc_inserted"] and out[1]["no"] == "2-2"
    assert out[0]["no"] == "2-1" and any("복원: 2-2" in c for c in rep["교정"]) and any("병합" in c for c in rep["교정"])
    bad = [{"name": f"엉뚱{i}", "start_page": 3 + i, "end_page": 3 + i} for i in range(3)]
    out2, rep2 = reconcile_with_toc(doc, bad, 5)
    assert out2 == bad and "신뢰불가" in rep2["mode"]              # 보수 게이트
    doc.close()


def test_arbiter_units_and_apply_remove_only_rejected():
    doc = fitz.open(stream=PDF, filetype="pdf")
    vs = [{"name": "A", "start_page": 3, "end_page": 3}, {"name": "B", "start_page": 4, "end_page": 5}]
    units = build_arbiter_units(doc, vs, diff_pages=[4])
    assert [u.key for u in units] == ["4"] and units[0].model == MODEL_ARBITER
    kept, logs = apply_arbiter_results(vs, {"4": UnitResult(ok=True, content='{"independent": false}')})
    assert [v["start_page"] for v in kept] == [3] and kept[0]["end_page"] == 3 and logs
    kept2, _ = apply_arbiter_results(vs, {"4": UnitResult(ok=False, error="x")})   # 실패 → 유지
    assert len(kept2) == 2 and kept2[1]["arbitrated"] is True
    doc.close()


def test_complement_and_scope_gate():
    vs = [{"start_page": 3, "end_page": 4}, {"start_page": 8, "end_page": 9}]
    assert complement(10, vs) == [{"span": [1, 2]}, {"span": [5, 7]}, {"span": [10, 10]}]
    assert scope_warning(10, vs) is None
    assert scope_warning(500, [{"start_page": 10, "end_page": 30}]) is not None
