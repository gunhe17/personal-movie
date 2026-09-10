"""ConfirmExtractionService 멱등 — 순수 단위(DB 불필요).

신 모델 확정 규약:
  - (name, program_year, program_organization) 멱등 upsert — 일치 voucher 재사용.
  - extraction.document_ids 전체를 voucher_documents 로 링크하되, 이미 있는 pair 는 스킵.
재확정/재실행 시 voucher·링크가 중복 생성되지 않는다.
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.modules.platform_admin.voucher.schemas import (
    ConfirmExtractionVoucherItem,
)
from app.modules.voucher.voucher.services.confirm_extraction import (
    ConfirmExtractionService,
    derive_eligibility,
)

_RECORD = {
    "연령기준": {"최소": 7, "최대": 12},
    "소득기준": {"최대": 120},
    "욕구기준": {"지표": [{"내용": "추천 필요"}]},
}


def _item(**over) -> dict:
    base = dict(
        name="우리아이심리지원",
        program_name="심리지원사업",
        program_organization="보건복지부",
        program_year=2026,
        page_range=(12, 18),
    )
    base.update(over)
    return ConfirmExtractionVoucherItem(**base).model_dump()


def _voucher_repo(*, existing=None) -> AsyncMock:
    """멱등 조회(find_active_duplicate)와 add 를 모킹."""
    repo = AsyncMock()
    repo.find_active_duplicate = AsyncMock(return_value=existing)
    created = SimpleNamespace(id="v-new", name="우리아이심리지원", program_year=2026)
    repo.add = AsyncMock(return_value=created)
    return repo


async def test_creates_voucher_and_links_all_documents():
    voucher_repo = _voucher_repo(existing=None)  # 신규 voucher
    link_repo = AsyncMock()
    link_repo.find_pair = AsyncMock(return_value=None)  # 링크 전부 신규
    link_repo.add = AsyncMock()

    svc = ConfirmExtractionService(voucher_repo, link_repo)
    result = await svc.execute(
        vouchers=[_item()],
        document_ids=["doc-pdf", "doc-hwpx", "doc-md"],
    )

    assert result.voucher_created_count == 1
    assert result.voucher_reused_count == 0
    # document_ids 전체(pdf·hwpx·md)에 링크 생성
    assert result.link_created_count == 3
    assert link_repo.add.await_count == 3


async def test_idempotent_reuses_voucher_and_skips_existing_links():
    existing_voucher = SimpleNamespace(
        id="v-1", name="우리아이심리지원", program_year=2026
    )
    voucher_repo = _voucher_repo(existing=existing_voucher)  # 일치 voucher 재사용
    link_repo = AsyncMock()
    link_repo.find_pair = AsyncMock(return_value=object())  # 모든 pair 이미 존재
    link_repo.add = AsyncMock()

    svc = ConfirmExtractionService(voucher_repo, link_repo)
    result = await svc.execute(
        vouchers=[_item()],
        document_ids=["doc-pdf", "doc-hwpx"],
    )

    assert result.voucher_created_count == 0
    assert result.voucher_reused_count == 1
    assert result.link_created_count == 0
    voucher_repo.add.assert_not_awaited()
    link_repo.add.assert_not_awaited()


class TestDeriveEligibility:
    def test_full_record(self):
        assert derive_eligibility(_RECORD) == {
            "min_age_months": None,
            "max_age_months": None,
            "income_max_won": None,
            "min_age": 7,
            "max_age": 12,
            "income_max_pct": 120,
            "need_evidence": True,
        }

    def test_partial_and_missing_axes(self):
        # 유도되지 않은 축도 키는 낸다 — 누락(undefined)을 소비자가 "설정됨"으로 읽는다
        assert derive_eligibility(
            {"연령기준": {"최대": 18}, "욕구기준": {"지표": []}}
        ) == {
            "min_age_months": None,
            "max_age_months": None,
            "income_max_won": None,
            "min_age": None,
            "max_age": 18,
            "income_max_pct": None,
            "need_evidence": False,
        }

    def test_no_axes_returns_none(self):
        assert derive_eligibility({"서비스": [{"유형명": "x"}]}) is None
        assert derive_eligibility(None) is None

    def test_age_none_is_explicit_null_not_missing(self):
        # "연령 제한 없음" = 확인된 무제약 → 기준 미정(None)이 아니라 null 경계
        assert derive_eligibility({"연령기준": {"없음": True}}) == {
            "min_age_months": None,
            "max_age_months": None,
            "income_max_won": None,
            "min_age": None,
            "max_age": None,
            "income_max_pct": None,
            "need_evidence": False,
        }

    def test_months_bounds_floor_to_years(self):
        # normalize 의 개월 경계(E25) — 만 나이로 내림
        rule = derive_eligibility({"연령기준": {"최소개월": 6, "최대개월": 35}})
        assert (rule["min_age"], rule["max_age"]) == (0, 2)

    def test_year_bound_wins_over_months(self):
        rule = derive_eligibility({"연령기준": {"최대": 12, "최대개월": 35}})
        assert rule["max_age"] == 12

    def test_new_generic_keys_won_and_months(self):
        # 범용 확대(P10 후속): 절대액 소득 상한·개월 원본 — 현 매처 미사용, 데이터만 굳힘
        rule = derive_eligibility({"소득기준": {"최대액": 3_600_000},
                                   "연령기준": {"최소개월": 6, "최대개월": 35}})
        assert rule["income_max_won"] == 3_600_000 and rule["income_max_pct"] is None
        assert (rule["min_age_months"], rule["max_age_months"]) == (6, 35)
        assert (rule["min_age"], rule["max_age"]) == (0, 2)

    def test_income_axis_without_pct_still_declares_key(self):
        # 소득 기준은 있으나 % 로 환산 안 된 경우 — null 로 명시(소득 '초과' 오차단 방지)
        assert derive_eligibility({"소득기준": {"자격": ["수급자"]}}) == {
            "min_age_months": None,
            "max_age_months": None,
            "income_max_won": None,
            "min_age": None,
            "max_age": None,
            "income_max_pct": None,
            "need_evidence": False,
        }


async def test_new_voucher_derives_eligibility_from_record():
    voucher_repo = _voucher_repo(existing=None)
    link_repo = AsyncMock()
    link_repo.find_pair = AsyncMock(return_value=None)
    link_repo.add = AsyncMock()

    svc = ConfirmExtractionService(voucher_repo, link_repo)
    await svc.execute(vouchers=[_item(record=_RECORD)], document_ids=["doc-pdf"])

    _, kwargs = voucher_repo.add.await_args
    assert kwargs["record"] == _RECORD
    assert kwargs["eligibility"] == {
        "min_age_months": None,
            "max_age_months": None,
            "income_max_won": None,
            "min_age": 7, "max_age": 12, "income_max_pct": 120, "need_evidence": True,
    }


async def test_operator_eligibility_wins_over_derived():
    voucher_repo = _voucher_repo(existing=None)
    link_repo = AsyncMock()
    link_repo.find_pair = AsyncMock(return_value=None)
    link_repo.add = AsyncMock()

    svc = ConfirmExtractionService(voucher_repo, link_repo)
    await svc.execute(
        vouchers=[_item(record=_RECORD, eligibility={"min_age": 99})],
        document_ids=["doc-pdf"],
    )
    _, kwargs = voucher_repo.add.await_args
    assert kwargs["eligibility"] == {"min_age": 99}


async def test_reuse_refreshes_record_and_derived_fields():
    # 재확정 = confirm 편집 최신본. record + 파생 구 필드(support_*)·eligibility 모두 갱신.
    existing = SimpleNamespace(
        id="v-1", name="우리아이심리지원", program_year=2026, eligibility=None
    )
    voucher_repo = _voucher_repo(existing=existing)
    voucher_repo.update_in_place = AsyncMock()
    link_repo = AsyncMock()
    link_repo.find_pair = AsyncMock(return_value=object())

    svc = ConfirmExtractionService(voucher_repo, link_repo)
    await svc.execute(
        vouchers=[_item(record=_RECORD, support_target="편집된 대상", support_scope="편집된 범위")],
        document_ids=["doc-pdf"],
    )

    _, kwargs = voucher_repo.update_in_place.await_args
    assert kwargs["record"] == _RECORD
    assert kwargs["eligibility"]["max_age"] == 12  # 편집된 record 기준 재유도
    assert kwargs["support_target"] == "편집된 대상"  # 편집된 구 필드 반영
    assert kwargs["support_scope"] == "편집된 범위"
