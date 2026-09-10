"""DocumentToMarkdownService — build_units/assemble 단위 테스트."""

from __future__ import annotations

import io

import fitz

from app.runtime.voucher_document.batch_unit import UnitResult
from app.runtime.voucher_document.document_to_markdown.service import (
    DocumentToMarkdownService,
)


def _blank_pdf(pages: int = 1) -> bytes:
    doc = fitz.open()
    for _ in range(pages):
        doc.new_page(width=200, height=200)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def test_build_units_one_body_unit_per_blank_page():
    units = DocumentToMarkdownService.build_units(document_bytes=_blank_pdf(2))
    assert [u.key for u in units] == ["p-001", "p-002"]
    assert all(u.reasoning == {"effort": "low"} for u in units)


def test_assemble_merges_bodies():
    results = {
        "p-002": UnitResult(ok=True, content="# two", input_tokens=5, output_tokens=2),
        "p-001": UnitResult(ok=True, content="# one", input_tokens=3, output_tokens=1),
    }
    result = DocumentToMarkdownService.assemble(results)
    assert result.pages == {"p-001": "# one", "p-002": "# two"}
    assert result.chunks_processed == 2
    assert result.chunks_failed == 0
    assert result.total_input_tokens == 8
    assert result.total_output_tokens == 3


def test_assemble_substitutes_nested_marker():
    results = {
        "p-001": UnitResult(ok=True, content="head\n[[C0]]\ntail"),
        "p-001:[[C0]]": UnitResult(ok=True, content="nested table"),
    }
    result = DocumentToMarkdownService.assemble(results)
    assert result.pages["p-001"] == "head\nnested table\ntail"


def test_assemble_nested_failure_drops_page():
    results = {
        "p-001": UnitResult(ok=True, content="head\n[[C0]]\ntail"),
        "p-001:[[C0]]": UnitResult(ok=False, error="boom"),
    }
    result = DocumentToMarkdownService.assemble(results)
    assert result.pages == {}
    assert result.chunks_failed == 1
    assert result.failures[0].error == "boom"


def test_assemble_body_failure_recorded():
    results = {"p-001": UnitResult(ok=False, error="timeout")}
    result = DocumentToMarkdownService.assemble(results)
    assert result.pages == {}
    assert result.chunks_failed == 1
    assert result.failures[0].error == "timeout"


def test_transcription_units_use_text_response_format():
    # 전사 유닛은 {"type":"text"} 필수 — 미지정=json_object 강제로 md 슬롯이 JSON 오염(실측)
    import fitz, io
    doc = fitz.open(); doc.new_page(width=300, height=300)
    buf = io.BytesIO(); doc.save(buf)
    units = DocumentToMarkdownService.build_units(document_bytes=buf.getvalue())
    assert units and all(u.response_format == {"type": "text"} for u in units)
