"""S2c quote_snapping — snap 알고리즘·walk 주입·PDF 텍스트층 추출 테스트.

PDF 는 PyMuPDF 로 텍스트를 심어 생성 — extract_page_texts 가 실제 텍스트층을
읽는 경로까지 통과시킨다.
"""

import fitz

from app.runtime.voucher_document.markdown_to_voucher.quote_snapping import (
    extract_page_texts,
    snap_quote,
    snap_voucher_quotes,
)

PAGE_TEXT = "심리･행동 문제의 조기 발견 및 개입 본인부담금 18,000~88,000원"


def _pdf_with_text(*page_texts: str) -> bytes:
    doc = fitz.open()
    for text in page_texts:
        page = doc.new_page(width=400, height=200)
        # 기본 helv 폰트는 한글 글리프가 없어 텍스트층이 깨짐 — CJK 내장 폰트 사용
        page.insert_text((30, 100), text, fontsize=9, fontname="korea")
    return doc.tobytes()


class TestSnapQuote:
    def test_exact_when_substring(self):
        quote_pdf, match = snap_quote("조기 발견 및 개입", PAGE_TEXT)
        assert match == "exact" and quote_pdf == "조기 발견 및 개입"

    def test_snapped_corrects_middle_dot(self):
        # MD 의 일반 가운뎃점(·) ↔ PDF 의 전각(･) — 미세 차이를 PDF 표기로 교정
        quote_pdf, match = snap_quote("심리·행동 문제의 조기 발견", PAGE_TEXT)
        assert match == "snapped"
        assert quote_pdf is not None and "심리･행동" in quote_pdf

    def test_none_when_unrelated(self):
        quote_pdf, match = snap_quote("전혀 무관한 영어 alphabet zzz", PAGE_TEXT)
        assert match == "none" and quote_pdf is None

    def test_none_when_empty(self):
        assert snap_quote("", PAGE_TEXT) == (None, "none")
        assert snap_quote("아무거나", "") == (None, "none")


class TestExtractPageTexts:
    def test_reads_text_layer_per_page(self):
        pdf = _pdf_with_text("first page words", "second page words")
        texts = extract_page_texts(pdf)
        assert set(texts.keys()) == {"p-001", "p-002"}
        assert "first page words" in texts["p-001"]
        assert "second page words" in texts["p-002"]


class TestSnapVoucherQuotes:
    def test_walks_record_ref_and_inherits_page(self):
        # 신 payload: record 축의 ref(quote) 노드를 순회. capture 도 같은 규칙(둘 다 walk).
        pdf = _pdf_with_text("수원시 본인부담금 18,000원", "성남시 정부지원금 60,000원")
        vouchers = [{
            "record": {
                # 축 ref — 자기 page
                "소득기준": {"내용": "x", "ref": {"page": "p-001",
                                              "quote": "본인부담금 18,000원"}},
                # 배열 원소 — 원소별 page
                "금액": [{"명칭": "지원", "금액": [{"정부지원금": 60000,
                                  "ref": {"page": "p-002",
                                          "quote": "정부지원금 60,000원"}}]}],
                # 하위객체 — page 를 부모에서 상속
                "욕구기준": {"page": "p-001",
                          "지표": [{"내용": "y", "quote": "수원시"}]},
                # null 축 — 그대로 통과
                "제공인력": None,
            }
        }]

        stats = snap_voucher_quotes(vouchers, pdf)

        record = vouchers[0]["record"]
        assert record["소득기준"]["ref"]["match"] == "exact"
        assert record["금액"][0]["금액"][0]["ref"]["match"] == "exact"
        assert record["욕구기준"]["지표"][0]["match"] == "exact"
        assert record["제공인력"] is None
        assert stats.total == 3 and stats.findable == 3

    def test_missing_page_yields_none_match(self):
        pdf = _pdf_with_text("아무 페이지")
        vouchers = [{"record": {"소득기준": {"내용": "x", "quote": "아무"}}}]
        stats = snap_voucher_quotes(vouchers, pdf)
        assert vouchers[0]["record"]["소득기준"]["match"] == "none"
        assert stats.none == 1
