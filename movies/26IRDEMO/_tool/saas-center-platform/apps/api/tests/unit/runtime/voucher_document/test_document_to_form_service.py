"""DocumentToFormService — 독립 form 추출 엔진 단위 테스트.

전체 detect→partition→ground 경로는 라이브 스모크가 검증(실 LLM 필요). 여기선 오케스트레이션
진입·빈 서식 short-circuit·flex 미적용(표준 등급)만 확인한다.
"""
import io
import json

import fitz

from app.runtime.voucher_document.document_to_form.service import DocumentToFormService

from ._fakes import FakeAIGateway, mm_ok, test_ctx


def _blank_pdf() -> bytes:
    doc = fitz.open()
    doc.new_page(width=200, height=200)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def test_no_form_pages_returns_empty_and_uses_standard_tier():
    gw = FakeAIGateway([mm_ok(json.dumps({"is_form": False}))])

    result = await DocumentToFormService(gw).execute(
        document_bytes=_blank_pdf(), ai_context=test_ctx(purpose="form_extract_schema")
    )

    assert result == {}
    # 서식 아님 → detect에서 끝, partition/ground 미호출
    assert len(gw.calls) == 1
    # form은 flex 제외 — 표준 등급(service_tier=None)
    assert gw.calls[0].get("service_tier") is None
