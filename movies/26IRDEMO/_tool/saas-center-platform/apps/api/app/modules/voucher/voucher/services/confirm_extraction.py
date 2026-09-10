# 편집된 voucher payload 배열 → Voucher 카탈로그 승격 + voucher_documents 링크.
#
# 확정(confirm) 규약:
#   - 후보 편집은 화면 전용 → 서버는 편집 결과(payload)를 그대로 신뢰.
#   - 각 item: (name, program_year, program_organization) 멱등 upsert.
#   - 항목이 documents 를 주면 그것만 링크(문서마다 자기 page_range) — 원본 구간 +
#     그 구간에 속한 서식 페이지. 안 주면(구 클라이언트) 추출 문서 전량 + 바우처 구간.
#   - forms 는 deferred — 생성하지 않음.
#
# payload 는 검증된 dict (admin 요청 스키마 model_dump) — 모듈 경계에서 admin DTO 비의존.
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.infrastructure.persistence.range import to_range
from app.modules.voucher.voucher.models import Voucher
from app.modules.voucher.voucher.repository import VoucherRepository
from app.modules.voucher.voucher_document.repository import (
    VoucherDocumentRepository,
)


def derive_eligibility(record: dict | None) -> dict | None:
    """정규화 record → 자가진단 매칭 룰 {min_age, max_age, min_age_months, max_age_months,
    income_max_pct, income_max_won, need_evidence}.

    연령·소득 경계는 코드가 이미 표준형(정수)으로 환산해 둔 것을 그대로 옮긴다.
    유도할 축이 하나도 없으면 None(기준 미정 — 소비자는 pending 으로 안내).

    축 하나라도 유도되면 **네 키를 전부** 낸다. 소비자(mobile-client matching.ts)가
    `rule.x !== null` 로 판정해 키 누락(undefined)을 "설정됨"으로 읽기 때문 —
    income_max_pct 를 생략하면 소득 '초과' 답변이 전 바우처에서 오차단된다.
    확인된 무제약("연령 제한 없음")도 같은 이유로 키 생략이 아니라 명시적 null.
    """
    if not isinstance(record, dict):
        return None
    out = {"min_age": None, "max_age": None, "min_age_months": None, "max_age_months": None,
           "income_max_pct": None, "income_max_won": None, "need_evidence": False}
    known = False

    age = record.get("연령기준")
    if isinstance(age, dict):
        known = True
        if not age.get("없음"):
            # 개월 경계는 만 나이로 내림 — 룰에 개월 정밀도가 없어 경계 학년을 과차단하지 않는 쪽
            for bound, months, key in (("최소", "최소개월", "min_age"), ("최대", "최대개월", "max_age")):
                if isinstance(age.get(bound), int):
                    out[key] = age[bound]
                elif isinstance(age.get(months), int):
                    out[key] = age[months] // 12
                if isinstance(age.get(months), int):
                    out[key + "_months"] = age[months]   # 개월 원본 — 정밀 매칭 확장 대비(현 매처 미사용)

    income = record.get("소득기준")
    if isinstance(income, dict):
        known = True
        if isinstance(income.get("최대"), int):
            out["income_max_pct"] = income["최대"]
        if isinstance(income.get("최대액"), int):
            out["income_max_won"] = income["최대액"]   # 절대액 상한 — 질문지 확장 대비(현 매처 미사용)

    need = record.get("욕구기준")
    if isinstance(need, dict) and need.get("지표"):
        known = True
        out["need_evidence"] = True

    return out if known else None


@dataclass
class ConfirmedVoucherItem:
    voucher_id: str
    name: str
    program_year: int
    voucher_created: bool
    link_created_count: int


@dataclass
class ConfirmExtractionResult:
    items: list[ConfirmedVoucherItem]
    voucher_created_count: int
    voucher_reused_count: int
    link_created_count: int


class ConfirmExtractionService:
    # keeper: 다중 repo — item별 upsert(voucher)↔link(voucher_documents)가 인터리브된
    # 단일 애그리게이트 배치라 facade 분해 시 루프(비즈니스)가 facade로 새는 역위반 (결정 2026-07-06)
    def __init__(
        self,
        voucher_repo: VoucherRepository,
        link_repo: VoucherDocumentRepository,
    ):
        self.voucher_repo = voucher_repo
        self.link_repo = link_repo

    async def execute(
        self,
        *,
        vouchers: list[dict[str, Any]],
        document_ids: list[str],
    ) -> ConfirmExtractionResult:
        items: list[ConfirmedVoucherItem] = []
        voucher_created_count = 0
        voucher_reused_count = 0
        link_created_count = 0

        for payload in vouchers:
            voucher, created = await self._upsert_voucher(payload)
            if created:
                voucher_created_count += 1
            else:
                voucher_reused_count += 1

            # 붙일 문서 — 화면이 고른 목록이 있으면 그것만. 문서마다 자기 구간을 갖는다
            # (원본은 바우처 span, 서식 png 는 그 서식 한 쪽). 목록이 없으면 종전 전량.
            links = payload.get("documents")
            if not links:
                span = to_range(payload.get("page_range"))
                links = [{"global_document_id": gid, "page_range": None} for gid in document_ids]
                ranges = [span] * len(links)
            else:
                ranges = [to_range(l.get("page_range")) for l in links]

            link_created_for_item = 0
            for link, rng in zip(links, ranges):
                gdoc_id = link.get("global_document_id")
                if not gdoc_id:
                    continue
                existing = await self.link_repo.find_pair(
                    voucher_id=voucher.id,
                    global_document_id=gdoc_id,
                )
                if existing is not None:
                    continue
                await self.link_repo.add(
                    voucher_id=voucher.id,
                    global_document_id=gdoc_id,
                    page_range=rng,
                )
                link_created_for_item += 1

            link_created_count += link_created_for_item
            items.append(
                ConfirmedVoucherItem(
                    voucher_id=voucher.id,
                    name=voucher.name,
                    program_year=voucher.program_year,
                    voucher_created=created,
                    link_created_count=link_created_for_item,
                )
            )

        return ConfirmExtractionResult(
            items=items,
            voucher_created_count=voucher_created_count,
            voucher_reused_count=voucher_reused_count,
            link_created_count=link_created_count,
        )

    async def _upsert_voucher(
        self, payload: dict[str, Any]
    ) -> tuple[Voucher, bool]:
        record = payload.get("record")
        eligibility = payload.get("eligibility") or derive_eligibility(record)

        existing = await self.voucher_repo.find_active_duplicate(
            name=payload["name"],
            program_year=payload["program_year"],
            program_organization=payload["program_organization"],
        )
        if existing:
            await self._refresh_existing(existing, payload, record, eligibility)
            return existing, False

        voucher = await self.voucher_repo.add(
            name=payload["name"],
            program_name=payload["program_name"],
            program_organization=payload["program_organization"],
            program_year=payload["program_year"],
            usage_start_date=payload.get("usage_start_date"),
            usage_end_date=payload.get("usage_end_date"),
            application_method=payload.get("application_method"),
            application_start_date=payload.get("application_start_date"),
            application_end_date=payload.get("application_end_date"),
            support_amount=payload.get("support_amount"),
            support_scope=payload.get("support_scope"),
            support_target=payload.get("support_target"),
            contact=payload.get("contact"),
            eligibility=eligibility,
            record=record,
        )
        return voucher, True

    async def _refresh_existing(
        self,
        existing: Voucher,
        payload: dict[str, Any],
        record: dict | None,
        eligibility: dict | None,
    ) -> None:
        # 재확정 = 운영자가 confirm 에서 편집한 최신본. record(정본)와 그로부터 파생된
        # 구 필드(support_*)·eligibility 를 함께 갱신한다 — record 만 갱신하면 web·mobile 이
        # 읽는 구 필드가 스테일해진다. record 미전달(구 클라이언트)이면 스킵.
        if record is None:
            return
        await self.voucher_repo.update_in_place(
            existing.id,
            record=record,
            eligibility=eligibility,
            support_amount=payload.get("support_amount"),
            support_scope=payload.get("support_scope"),
            support_target=payload.get("support_target"),
            contact=payload.get("contact"),
        )
