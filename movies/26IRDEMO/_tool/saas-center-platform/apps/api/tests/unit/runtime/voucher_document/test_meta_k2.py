"""DM K=2 교집합 게이트 — lab E22 양방향 계약 (LLM 없음)."""
from __future__ import annotations

from app.runtime.voucher_document.markdown_to_voucher.meta import intersect_meta
from app.runtime.voucher_document.processing_spec import DOC_META_KEYS


def _cell(v, page="p-001"):
    return {"value": v, "page": page, "quote": str(v)[:20]}


def test_genuine_common_declaration_survives():
    """경기도 실측: 신청절차(동일)·근거법령(유사도 0.83) 생존."""
    m1 = {"application_method": _cell("1단계: 제공기관 등록·상담 후 제공계약, 2단계: 개인욕구 파악 후 서비스 제공 계획 수립"),
          "payment_method": _cell("실시간결제(회당 결제)")}
    m2 = {"application_method": _cell("1단계 : 제공기관 등록･상담 후 제공계약 - 2단계 : 개인욕구 파악 후 서비스 제공 계획 수립"),
          "payment_method": _cell("실시간결제(회당 결제)")}
    out = intersect_meta(m1, m2)
    assert out["application_method"] == m1["application_method"]
    assert out["payment_method"] == m1["payment_method"]


def test_nondeterministic_overextraction_dies():
    """장애인복지 실측: run1 null vs run2 특정사업 유래 값 → 소멸 (오상속 봉쇄)."""
    m1 = {"payment_method": None, "contact": None}
    m2 = {"payment_method": _cell("참여자 명의의 계좌로 지급"), "contact": _cell("보건복지부(장애인권익지원과)")}
    out = intersect_meta(m1, m2)
    assert out["payment_method"] is None and out["contact"] is None


def test_disagreeing_values_die_and_structured_values_compare():
    m1 = {"year": _cell(2026), "usage_period": _cell({"start": "2026-01-01", "end": "2026-12-31"}),
          "organization": _cell("경기도")}
    m2 = {"year": _cell(2026), "usage_period": _cell({"end": "2026-12-31", "start": "2026-01-01"}),
          "organization": _cell("보건복지부")}
    out = intersect_meta(m1, m2)
    assert out["year"] == m1["year"] and out["usage_period"] == m1["usage_period"]
    assert out["organization"] is None


def test_output_has_all_keys_null_when_missing():
    out = intersect_meta({}, {})
    assert set(out) == set(DOC_META_KEYS) and all(v is None for v in out.values())
