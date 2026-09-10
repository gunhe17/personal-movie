"""verification.py 등급 트리 — lab E17 계약 (합성 PDF, LLM 없음)."""
from __future__ import annotations

import io

import fitz

from app.runtime.voucher_document.markdown_to_voucher.verification import (
    REPAIR_GRADES,
    page_texts,
    verify_cells,
    verify_vouchers,
)


def _pdf(*page_texts_: str) -> bytes:
    doc = fitz.open()
    for t in page_texts_:
        page = doc.new_page(width=400, height=300)
        page.insert_text((30, 40), t, fontsize=10, fontname="korea")
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


PDF = _pdf(
    "장애인 의료비 지원 목적 생활이 어려운 저소득 장애인",       # p1
    "지원금액 장애인의료비 본인부담금 전액",                    # p2
    "머리글 장애인복지 사업안내 머리글 장애인복지 사업안내",       # p3
)


def _cell(value, page, quote=""):
    return {"value": value, "page": page, "quote": quote}


def test_confirmed_and_abstain_and_format():
    texts = page_texts(PDF)
    fields = {
        "사업명": _cell("장애인 의료비 지원", "p-001"),
        "목적": _cell(None, None),
        "집단규모": None,                              # 구조 축 미추출 → 기권 (P4 종단 실측: 형식불량 오판이 repair 23건 유발)
        "이상": "문자열은 셀이 아님",
    }
    g = verify_cells(fields, texts, 1, 3)
    assert g == {"사업명": "확인", "목적": "기권", "집단규모": "기권", "이상": "형식불량"}


def test_page_snap_corrects_misattributed_page():
    texts = page_texts(PDF)
    cell = _cell("본인부담금 전액", "p-001")                 # 토큰은 p2에만 — 스냅 대상
    g = verify_cells({"지원금액": cell}, texts, 1, 3)
    assert g["지원금액"] == "확인(스냅)"
    assert cell["page"] == "p-002" and cell["page_snapped"] is True


def test_unconfirmed_when_tokens_absent():
    texts = page_texts(PDF)
    g = verify_cells({"근거법령": _cell("아동복지법 제3조 시행령", "p-002")}, texts, 1, 3)
    assert g["근거법령"] == "미확인" and "미확인" in REPAIR_GRADES


def test_out_of_span_page_is_bad_source():
    texts = page_texts(PDF)
    g = verify_cells({"사업명": _cell("장애인 의료비 지원", "p-009")}, texts, 1, 3)
    assert g["사업명"].startswith("확인(") or g["사업명"] == "출처불량"   # 구간 밖 인용 → 스냅(유일/구간) 또는 출처불량
    assert g["사업명"] != "확인"                                         # 원 인용 그대로 통과는 불가


def test_array_axis_collects_element_pages():
    texts = page_texts(PDF)
    arr = [{"내용": "생활이 어려운 저소득 장애인", "page": "p-001", "quote": "…"}]
    g = verify_cells({"우선순위": arr}, texts, 1, 3)
    assert g["우선순위"] == "확인"


def test_inherited_cell_checked_against_origin_page():
    texts = page_texts(PDF)
    cell = {"value": "장애인의료비 본인부담금 (문서 공통)", "page": "p-002", "quote": "", "inherited": True}
    assert verify_cells({"지원금액": cell}, texts, 1, 1)["지원금액"] == "확인(공용)"


def test_scanned_mode_marks_unverified():
    texts = page_texts(PDF)
    g = verify_cells({"사업명": _cell("아무값", "p-001")}, texts, 1, 3, scanned=True)
    assert g["사업명"] == "미검증(스캔)"


def test_verify_vouchers_accepts_capture_or_fields_and_pNNN_span():
    vouchers = [
        {"name": "A", "span": ["p-001", "p-003"], "capture": {"사업명": _cell("장애인 의료비 지원", "p-001")}},
        {"name": "B", "span": [1, 3], "fields": {"목적": _cell(None, None)}},
    ]
    tally = verify_vouchers(vouchers, PDF)
    assert vouchers[0]["verify"] == {"사업명": "확인"} and vouchers[1]["verify"] == {"목적": "기권"}
    assert tally == {"확인": 1, "기권": 1}
