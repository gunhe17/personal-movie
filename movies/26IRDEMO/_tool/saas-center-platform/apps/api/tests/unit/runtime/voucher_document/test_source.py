"""source.py — 마커 파싱(구형/spec형 겸용)·슬라이스(spec형 방출) 테스트."""

from app.runtime.voucher_document.common.page_markdown import (
    full_markdown,
    load_pages_from_markdown,
    page_id,
    page_num,
    pages_markdown,
)


class TestPageIdHelpers:
    def test_page_num_parses_padded_id(self):
        assert page_num("p-031") == 31

    def test_page_num_none_for_garbage(self):
        assert page_num(None) is None
        assert page_num("페이지") is None
        assert page_num("p-000") is None

    def test_page_id_zero_pads(self):
        assert page_id(7) == "p-007"


class TestLoadPages:
    def test_parses_legacy_markers(self):
        md = "<!-- p-001 -->\n첫 페이지\n\n<!-- p-002 -->\n둘째 페이지"
        pages = load_pages_from_markdown(md)
        assert pages == {1: "첫 페이지", 2: "둘째 페이지"}

    def test_parses_spec_markers(self):
        md = (
            "<!-- ═══════════ p-001 ═══════════ -->\n첫\n\n"
            "<!-- ═══════════ p-002 ═══════════ -->\n둘"
        )
        pages = load_pages_from_markdown(md)
        assert pages == {1: "첫", 2: "둘"}

    def test_no_markers_returns_empty(self):
        assert load_pages_from_markdown("그냥 본문") == {}


class TestSliceEmission:
    def test_pages_markdown_emits_spec_markers(self):
        out = pages_markdown({1: "A", 2: "B", 3: "C"}, 2, 3)
        assert "<!-- ═══════════ p-002 ═══════════ -->\nB" in out
        assert "<!-- ═══════════ p-003 ═══════════ -->\nC" in out
        assert "p-001" not in out

    def test_full_markdown_round_trips(self):
        pages = {1: "A", 3: "C"}
        out = full_markdown(pages)
        # spec 마커로 방출한 문서를 다시 파싱하면 동일 페이지 맵
        assert load_pages_from_markdown(out) == pages

    def test_full_markdown_empty(self):
        assert full_markdown({}) == ""
