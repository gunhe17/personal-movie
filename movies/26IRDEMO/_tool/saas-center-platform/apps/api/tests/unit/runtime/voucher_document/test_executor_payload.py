"""build_completed_payload 단위 테스트 (spec §6 구조).

type/source_url 보존 + vouchers/forms replace 시맨틱을 고정한다.
(로직은 executor → voucher_extraction/services/mark_completed 로 이동)
"""

from app.modules.voucher.voucher_extraction.services.mark_completed import (
    build_completed_payload,
)

VOUCHER = {
    "no": "1",
    "name": "우리아이심리지원서비스",
    "code": "010109",
    "span": ["p-031", "p-038"],
    "fields": {"purpose": {"value": "목적", "page": "p-031"}},
}
FORM = {"page": "p-163", "title": "종결 보고서", "kind": "보고서",
        "global_document_id": "gd-1"}


def test_preserves_meta_and_replaces_vouchers_and_forms():
    existing = {
        "type": "manual",
        "source_url": "https://example.gov",
        "vouchers": [{"old": 1}],
        "forms": [{"old": 2}],
    }
    out = build_completed_payload(
        existing, meta={}, vouchers=[VOUCHER], forms=[FORM]
    )

    assert out["type"] == "manual"
    assert out["source_url"] == "https://example.gov"
    assert out["vouchers"] == [VOUCHER]
    assert out["forms"] == [FORM]


def test_none_existing_yields_null_meta_empty_lists():
    assert build_completed_payload(None, meta={}, vouchers=[], forms=[]) == {
        "type": None,
        "source_url": None,
        "meta": {},
        "vouchers": [],
        "forms": [],
    }


def test_voucher_order_preserved():
    v2 = dict(VOUCHER, no="2", name="다른사업")
    out = build_completed_payload(
        {"type": "t", "source_url": "u"},
        meta={},
        vouchers=[VOUCHER, v2],
        forms=[],
    )
    assert [v["no"] for v in out["vouchers"]] == ["1", "2"]
