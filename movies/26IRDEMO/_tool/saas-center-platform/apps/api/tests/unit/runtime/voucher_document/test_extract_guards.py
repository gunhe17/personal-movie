"""runner.py 전멸 가드 — 전부-실패는 예외, 빈 문서만 빈 완료.

S1 전 페이지 실패·S2a 호출 에러·S2b 전멸이 조용한 completed(후보 0)로
저장되던 결함(2026-07-23 실측)의 회귀 테스트 — 단일 파이프라인(runner.py)
전환 후에도 같은 가드가 유지되는지 확인한다(구 ExtractVouchersFromDocumentService는
새 파이프라인 배선 완료로 소멸).
"""
from __future__ import annotations

import io

import fitz
import pytest

from app.core.exceptions import InvalidOperationException
from app.runtime.voucher_document.extract_job import runner as runner_mod
from app.runtime.voucher_document.extract_job.runner import advance_field, advance_s1, advance_s2a, advance_tx
from app.runtime.voucher_document.markdown_to_voucher.schemas import VoucherSpan

from ._fakes import FakeAIGateway, mm_fail, mm_ok


def _blank_pdf(pages: int = 1) -> bytes:
    doc = fitz.open()
    for _ in range(pages):
        doc.new_page(width=200, height=200)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


class FakeStorage:
    def __init__(
        self,
        files: dict[str, bytes] | None = None,
    ):
        self._files = dict(files or {})

    async def download_file(
        self,
        path: str,
    ) -> bytes:
        return self._files[path]


class FakeDoc:
    def __init__(
        self,
        id_="d1",
        name="테스트",
        file_type="pdf",
        storage_path="p/1.pdf",
    ):
        self.id, self.name, self.file_type, self.storage_path = id_, name, file_type, storage_path


class FakeGdocFacade:
    def __init__(
        self,
        doc: FakeDoc,
    ):
        self._doc = doc

    async def get_many_including_deleted(
        self,
        ids,
    ):
        return [self._doc]


EXTRACTION = type("E", (), {"id": "e1", "source_document_ids": ["d1"]})()


def _md_progress(md_storage_path: str = "md/1.md", **data_extra) -> dict:
    return {
        "stage": "s2a",
        "data": {"md_storage_path": md_storage_path, **data_extra},
    }


class TestS1TotalFailure:
    async def test_zero_pages_raises_with_reason(self):
        gdoc = FakeGdocFacade(FakeDoc())
        storage = FakeStorage({"p/1.pdf": _blank_pdf(1)})
        ai_facade = FakeAIGateway([mm_fail("401 no key")])
        progress = {"stage": "s1", "data": {}}

        with pytest.raises(InvalidOperationException, match="전 페이지 실패.*401 no key"):
            await advance_s1(
                ai_facade=ai_facade, voucher_facade=None, gdoc_facade=gdoc,
                storage=storage, extraction=EXTRACTION, progress=progress,
            )


class TestS2aGuards:
    async def test_separation_call_error_raises(self):
        md = "<!-- p-001 -->\n본문"
        storage = FakeStorage({"md/1.md": md.encode("utf-8")})
        ai_facade = FakeAIGateway([mm_fail("empty response")])
        # attempt를 이미 fallback으로 둬서 재시도 없이 바로 실패 분기로 간다
        progress = _md_progress(s2a_attempt="fallback")

        with pytest.raises(InvalidOperationException, match="바우처 분리 호출이 실패했습니다.*empty response"):
            await advance_s2a(
                ai_facade=ai_facade, voucher_facade=None, gdoc_facade=None,
                storage=storage, extraction=EXTRACTION, progress=progress,
            )

    async def test_primary_zero_spans_retries_with_fallback(self):
        # 주 모델 분리 0건(정상 응답) → 같은 stage 유지 + attempt=fallback 재분리 전이
        md = "<!-- p-001 -->\n본문"
        storage = FakeStorage({"md/1.md": md.encode("utf-8")})
        ai_facade = FakeAIGateway([mm_ok('{"vouchers": [], "common": []}')])
        progress = _md_progress()

        result = await advance_s2a(
            ai_facade=ai_facade, voucher_facade=None, gdoc_facade=None,
            storage=storage, extraction=EXTRACTION, progress=progress,
        )

        assert result["stage"] == "s2a"
        assert result["data"]["s2a_attempt"] == "fallback"

    async def test_legit_empty_document_completes(self):
        md = "<!-- p-001 -->\n본문"
        storage = FakeStorage({"md/1.md": md.encode("utf-8")})
        ai_facade = FakeAIGateway([mm_ok('{"vouchers": [], "common": []}')])
        progress = _md_progress(s2a_attempt="fallback")

        result = await advance_s2a(
            ai_facade=ai_facade, voucher_facade=None, gdoc_facade=None,
            storage=storage, extraction=EXTRACTION, progress=progress,
        )

        # 분리 0건도 s3_detect(서식 정의) → review 로 — 사용자가 영역을 수동 추가할 수 있다
        assert result["stage"] == "s3_detect"
        assert result["data"]["spans"] == []


class TestFieldGuards:
    async def test_fields_total_failure_raises(self):
        md = "<!-- p-001 -->\n본문"
        storage = FakeStorage({"md/1.md": md.encode("utf-8"), "p/1.pdf": _blank_pdf(2)})
        gdoc = FakeGdocFacade(FakeDoc())
        ai_facade = FakeAIGateway([mm_fail("rate limited")] * 9)                       # 9그룹 전부 실패
        progress = {"stage": "field", "data": {
            "md_storage_path": "md/1.md", "table_pages": [],
            "spans": [{"no": "1", "name": "사업A", "code": None, "start_page": "p-001", "end_page": "p-002"}],
        }}

        with pytest.raises(InvalidOperationException, match="필드 추출이 전부 실패.*rate limited"):
            await advance_field(
                ai_facade=ai_facade, voucher_facade=None, gdoc_facade=gdoc,
                storage=storage, extraction=EXTRACTION, progress=progress,
            )

    async def test_partial_failure_keeps_going_with_extract_error(self):
        md = "<!-- p-001 -->\n사업A 본문\n\n<!-- p-002 -->\n사업B 본문"
        storage = FakeStorage({"md/1.md": md.encode("utf-8"), "p/1.pdf": _blank_pdf(2)})
        gdoc = FakeGdocFacade(FakeDoc())
        ai_facade = FakeAIGateway([mm_ok('{"목적": {"value": null, "page": null, "quote": null}}')] * 9 + [mm_fail("boom")] * 9)
        progress = {"stage": "field", "data": {
            "md_storage_path": "md/1.md", "table_pages": [],
            "spans": [{"no": "1", "name": "사업A", "code": None, "start_page": "p-001", "end_page": "p-001"},
                      {"no": "2", "name": "사업B", "code": None, "start_page": "p-002", "end_page": "p-002"}],
        }}
        # 청크 전진 — 한 번에 FIELD_CHUNK 바우처. 같은 stage 를 돌려주며 이어간다.
        result = await advance_field(
            ai_facade=ai_facade, voucher_facade=None, gdoc_facade=gdoc,
            storage=storage, extraction=EXTRACTION, progress=progress,
        )
        assert result["stage"] == "field" and len(result["data"]["vouchers"]) == 1

        result = await advance_field(
            ai_facade=ai_facade, voucher_facade=None, gdoc_facade=gdoc,
            storage=storage, extraction=EXTRACTION, progress=result,
        )
        vs = result["data"]["vouchers"]
        assert result["stage"] == "repair" and len(vs) == 2
        assert vs[0]["extract_error"] is False and vs[0]["span"] == [1, 1] and "verify" in vs[0]
        assert vs[1]["extract_error"] is True and vs[1]["fields"] is None

    async def test_resume_retries_failed_vouchers_in_place(self):
        # 실패분(extract_error)이 있으면 남은 바우처보다 먼저 그 자리에 재시도한다
        md = "<!-- p-001 -->\n사업A 본문\n\n<!-- p-002 -->\n사업B 본문"
        storage = FakeStorage({"md/1.md": md.encode("utf-8"), "p/1.pdf": _blank_pdf(2)})
        gdoc = FakeGdocFacade(FakeDoc())
        ai_facade = FakeAIGateway([mm_ok('{"목적": {"value": null, "page": null, "quote": null}}')] * 9)
        progress = {"stage": "field", "data": {
            "md_storage_path": "md/1.md", "table_pages": [],
            "spans": [{"no": "1", "name": "사업A", "code": None, "start_page": "p-001", "end_page": "p-001"},
                      {"no": "2", "name": "사업B", "code": None, "start_page": "p-002", "end_page": "p-002"}],
            "vouchers": [
                {"no": "1", "name": "사업A", "code": None, "span": [1, 1],
                 "fields": None, "extract_error": True},
                {"no": "2", "name": "사업B", "code": None, "span": [2, 2],
                 "fields": {"목적": None}, "extract_error": False},
            ],
        }}
        result = await advance_field(
            ai_facade=ai_facade, voucher_facade=None, gdoc_facade=gdoc,
            storage=storage, extraction=EXTRACTION, progress=progress,
        )
        vs = result["data"]["vouchers"]
        assert result["stage"] == "repair" and len(vs) == 2
        assert vs[0]["extract_error"] is False and vs[0]["fields"] is not None  # 자리 교체
        assert vs[1]["extract_error"] is False                                  # 기존 성공분 보존


class TestTxGuards:
    """tx — 넘친 표 페이지만 전사. |S|≤12 이면 LLM 0콜, 실패 페이지는 텍스트층 유지."""

    async def test_no_overflow_skips_llm(self):
        storage = FakeStorage({"md/1.md": b"<!-- p-001 -->\nx", "p/1.pdf": _blank_pdf(2)})
        ai_facade = FakeAIGateway([])
        progress = {"stage": "tx", "data": {"md_storage_path": "md/1.md", "table_pages": [1, 2], "n_pages": 2,
                    "spans": [{"no": "1", "name": "A", "code": None, "start_page": "p-001", "end_page": "p-002"}]}}
        result = await advance_tx(ai_facade=ai_facade, voucher_facade=None, gdoc_facade=FakeGdocFacade(FakeDoc()),
                                  storage=storage, extraction=EXTRACTION, progress=progress)
        assert result["stage"] == "field" and result["data"]["transcribed_pages"] == [] and ai_facade.calls == []

    async def test_overflow_pages_transcribed_and_saved(self, monkeypatch):
        n = 14
        md = "\n\n".join(f"<!-- p-{i:03d} -->\n본문{i}" for i in range(1, n + 1))
        storage = FakeStorage({"md/1.md": md.encode(), "p/1.pdf": _blank_pdf(n)})
        saved = {}
        class FakeSave:
            def __init__(self, **kw): pass
            async def execute(self, *, extraction, merged_markdown, name):
                saved["md"] = merged_markdown
                return type("S", (), {"storage_path": "md/2.md"})()
        monkeypatch.setattr(runner_mod, "SaveVoucherMarkdownService", FakeSave)
        ai_facade = FakeAIGateway([mm_ok("전사13"), mm_fail("boom")])                # p-013 성공, p-014 실패
        progress = {"stage": "tx", "data": {"md_storage_path": "md/1.md", "table_pages": list(range(1, n + 1)), "n_pages": n,
                    "spans": [{"no": "1", "name": "A", "code": None, "start_page": "p-001", "end_page": f"p-{n:03d}"}]}}
        result = await advance_tx(ai_facade=ai_facade, voucher_facade=None, gdoc_facade=FakeGdocFacade(FakeDoc()),
                                  storage=storage, extraction=EXTRACTION, progress=progress)
        assert result["stage"] == "field" and len(ai_facade.calls) == 2
        assert result["data"]["transcribed_pages"] == [13] and result["data"]["md_storage_path"] == "md/2.md"
        assert "<!-- p-013 -->\n전사13" in saved["md"] and "<!-- p-014 -->\n본문14" in saved["md"]   # 실패 페이지 텍스트층 유지
