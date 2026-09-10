"""Admin 바우처 추출 확정 E2E.

confirm 은 편집된 voucher payload 배열을 받아 Voucher 카탈로그에 멱등 upsert 하고
extraction 의 문서들을 voucher_documents 로 링크한다(payload 를 신뢰).
리팩토링(voucher 모듈로 write 이관) 전 엔드포인트 동작을 고정한다.

extraction 은 워커 없이 DB 에 직접 시드한다(문서 없이 → upsert 동작만 고정).
"""
import pytest
from httpx import AsyncClient

from tests.e2e.test_06_voucher_admin_flow import admin_headers


async def _seed_extraction() -> str:
    """started 상태 VoucherExtraction 1건(문서 없음) 시드 → extraction_id."""
    from app.infrastructure.persistence.database import AsyncSessionLocal
    from app.modules.voucher.voucher_extraction.models import VoucherExtraction
    from scripts.seed.develop import gen_id

    async with AsyncSessionLocal() as s:
        extraction_id = gen_id()
        s.add(VoucherExtraction(
            id=extraction_id,
            source_document_ids=[],
            artifact_document_ids=[],
        ))
        await s.commit()
    return extraction_id


def _voucher_payload(name: str) -> dict:
    return {
        "name": name,
        "program_name": "E2E 추출 프로그램",
        "program_organization": "E2E 기관",
        "program_year": 2026,
        "usage_start_date": "2026-01-01",
        "usage_end_date": "2026-12-31",
    }


@pytest.mark.asyncio
async def test_admin_voucher_extraction_confirm_flow(api: AsyncClient):
    headers = await admin_headers()
    extraction_id = await _seed_extraction()
    name = "E2E 추출바우처"

    # 1. 확정 → 200, voucher 신규 1건
    r = await api.post(
        f"/api/v1/admin/voucher-extractions/{extraction_id}/confirm",
        headers=headers,
        json={"vouchers": [_voucher_payload(name)]},
    )
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body["voucher_created_count"] == 1
    assert body["voucher_reused_count"] == 0
    assert len(body["items"]) == 1

    # 2. 동일 (name, year, organization) 재확정 → 멱등 재사용
    r = await api.post(
        f"/api/v1/admin/voucher-extractions/{extraction_id}/confirm",
        headers=headers,
        json={"vouchers": [_voucher_payload(name)]},
    )
    assert r.status_code in (200, 201), r.text
    assert r.json()["voucher_created_count"] == 0
    assert r.json()["voucher_reused_count"] == 1


@pytest.mark.asyncio
async def test_admin_voucher_confirm_unknown_extraction_404(api: AsyncClient):
    headers = await admin_headers()
    from scripts.seed.develop import gen_id

    r = await api.post(
        f"/api/v1/admin/voucher-extractions/{gen_id()}/confirm",
        headers=headers,
        json={"vouchers": [_voucher_payload("x")]},
    )
    assert r.status_code == 404, r.text
