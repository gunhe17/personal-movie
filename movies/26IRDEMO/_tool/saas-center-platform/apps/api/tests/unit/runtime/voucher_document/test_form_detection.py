"""S3 form_detection — 페이지 판정 조립·kind 클램프·실패 격리 테스트.

PDF 는 PyMuPDF 로 만든 2페이지 빈 문서 — 렌더 경로까지 실제 코드를 통과시키고
LLM 결과는 UnitResult 로 대체한다(실행은 runner `run_stage` 소유).
"""

import json

import fitz

from app.runtime.voucher_document.batch_unit import UnitResult
from app.runtime.voucher_document.document_to_form.page_detect import (
    FormPageDetectService,
    _clamp_kind,
)


def _pdf_bytes(pages: int = 2) -> bytes:
    doc = fitz.open()
    for _ in range(pages):
        doc.new_page(width=200, height=200)
    return doc.tobytes()


def _judgement(is_form: bool, **kw) -> str:
    base = {"is_form": is_form, "title": "", "kind": "", "reason": "r"}
    base.update(kw)
    return json.dumps(base, ensure_ascii=False)


class TestBuildUnits:
    def test_one_unit_per_page(self):
        units = FormPageDetectService.build_units(document_bytes=_pdf_bytes(2), model="m")
        assert [u.key for u in units] == ["p-001", "p-002"]
        assert all(u.model == "m" for u in units)
        content = units[0].messages[1]["content"]
        assert content[0]["type"] == "image_url"
        assert content[0]["image_url"]["url"].startswith("data:image/png;base64,")


class TestAssemble:
    def test_collects_only_form_pages(self):
        results = {
            "p-001": UnitResult(ok=True, content=_judgement(False)),
            "p-002": UnitResult(ok=True, content=_judgement(True, title="보고서", kind="보고서")),
        }
        result = FormPageDetectService.assemble(results, model="m")
        assert result.pages_judged == 2
        assert [fp.page for fp in result.form_pages] == ["p-002"]
        assert result.failures == []

    def test_failed_unit_recorded(self):
        results = {"p-001": UnitResult(ok=False, error="boom")}
        result = FormPageDetectService.assemble(results, model="m")
        assert len(result.failures) == 1 and result.failures[0].error == "boom"
        assert result.form_pages == []

    def test_unparsable_content_is_failure(self):
        results = {"p-001": UnitResult(ok=True, content="이건 JSON 아님")}
        result = FormPageDetectService.assemble(results, model="m")
        assert len(result.failures) == 1
        assert result.form_pages == []

    def test_code_fenced_json_tolerated(self):
        fenced = "```json\n" + _judgement(True, kind="동의서") + "\n```"
        results = {"p-001": UnitResult(ok=True, content=fenced)}
        result = FormPageDetectService.assemble(results, model="m")
        assert len(result.form_pages) == 1


class TestKindClamp:
    def test_known_kind_kept(self):
        assert _clamp_kind("신청서") == "신청서"

    def test_unknown_kind_becomes_etc(self):
        assert _clamp_kind("희한한분류") == "기타"

    def test_empty_stays_empty(self):
        assert _clamp_kind("") == ""
        assert _clamp_kind(None) == ""
