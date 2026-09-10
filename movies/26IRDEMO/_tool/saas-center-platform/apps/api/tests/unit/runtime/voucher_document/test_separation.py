"""S2a separation — span/common 파싱·실패 경로·unit 구성 테스트."""

import json

from app.runtime.voucher_document.batch_unit import UnitResult
from app.runtime.voucher_document.markdown_to_voucher.separation import (
    build_separation_unit,
    parse_separation_result,
)

S2A_DATA = {
    "vouchers": [
        {
            "no": "1",
            "name": "우리아이심리지원서비스",
            "code": "010109",
            "start_page": "p-031",
            "end_page": "p-038",
            "indicators": ["①", "②", "③"],
            "rationale": "고유 코드와 대상·단가·인력 기준이 독립적으로 구성됨.",
        },
        # name 누락 → 버려짐
        {"no": "2", "code": "130209", "start_page": "p-039", "end_page": "p-044"},
        # 페이지 해석 불가 → 버려짐
        {"no": "3", "name": "X", "start_page": "??", "end_page": "p-050"},
    ],
    "common": [
        {"label": "사업 개요", "start_page": "p-001", "end_page": "p-030"},
        {"label": "broken", "start_page": None, "end_page": "p-002"},
    ],
}


def test_parses_spans_and_commons_dropping_invalid():
    result = UnitResult(ok=True, content=json.dumps(S2A_DATA, ensure_ascii=False))
    spans, commons = parse_separation_result(result)

    assert len(spans) == 1
    s = spans[0]
    assert (s.no, s.name, s.code) == ("1", "우리아이심리지원서비스", "010109")
    assert (s.start_page, s.end_page) == ("p-031", "p-038")
    assert s.indicators == ["①", "②", "③"]
    assert len(commons) == 1 and commons[0].label == "사업 개요"


def test_failure_returns_empty():
    spans, commons = parse_separation_result(UnitResult(ok=False, error="HTTP 429"))
    assert spans == [] and commons == []


def test_unit_carries_full_document_with_spec_prompt():
    unit = build_separation_unit(model="m", full_doc="<<문서전체>>")

    assert unit.key == "separate"
    assert unit.temperature == 1.0
    assert unit.max_tokens == 16000
    system, user = unit.messages
    assert "개별 바우처" in system["content"]
    assert "<<문서전체>>" in user["content"]
