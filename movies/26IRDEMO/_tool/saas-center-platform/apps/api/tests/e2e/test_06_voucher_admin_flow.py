"""Admin voucher 카탈로그 CRUD E2E.

플랫폼 admin 엔드포인트(/api/v1/admin/vouchers) 동작 고정용.
admin 2FA는 이메일 발송이라 e2e에선 토큰을 직접 발급해 우회한다(엔드포인트 검증이 목적).
"""
import pytest
from httpx import AsyncClient


async def admin_headers() -> dict:
    """seed admin(ADMIN) 계정으로 admin access token 직접 발급 → 헤더."""
    from sqlalchemy import select
    from app.infrastructure.persistence.database import AsyncSessionLocal
    from app.modules.platform_admin.admin_account.models import AdminAccount
    from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
    from app.modules.platform_admin.admin_account.services.create_admin_access_token import (
        CreateAdminAccessTokenService,
    )

    async with AsyncSessionLocal() as s:
        admin = (
            await s.execute(
                select(AdminAccount).where(AdminAccount.email == "admin@insighter.co.kr")
            )
        ).scalar_one()
        token, _ = await CreateAdminAccessTokenService(AdminAccountRepository(s)).execute(
            admin.id
        )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_admin_voucher_crud_flow(api: AsyncClient):
    headers = await admin_headers()

    # 1. 생성
    r = await api.post(
        "/api/v1/admin/vouchers",
        headers=headers,
        json={
            "name": "E2E 바우처",
            "program_name": "E2E 프로그램",
            "program_organization": "E2E 기관",
            "program_year": 2026,
            "usage_start_date": "2026-01-01",
            "usage_end_date": "2026-12-31",
        },
    )
    assert r.status_code == 201, r.text
    voucher_id = r.json()["id"]
    assert r.json()["name"] == "E2E 바우처"

    # 2. 상세 조회
    r = await api.get(f"/api/v1/admin/vouchers/{voucher_id}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["program_year"] == 2026

    # 3. 수정 (부분)
    r = await api.patch(
        f"/api/v1/admin/vouchers/{voucher_id}",
        headers=headers,
        json={"name": "E2E 바우처-수정"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "E2E 바우처-수정"

    # 4. 날짜 검증 (이용 시작 > 종료 → 거부)
    r = await api.patch(
        f"/api/v1/admin/vouchers/{voucher_id}",
        headers=headers,
        json={"usage_start_date": "2026-12-31", "usage_end_date": "2026-01-01"},
    )
    assert r.status_code in (400, 409, 422), r.text

    # 5. 삭제 (soft)
    r = await api.delete(f"/api/v1/admin/vouchers/{voucher_id}", headers=headers)
    assert r.status_code == 200, r.text

    # 6. soft delete — admin 상세조회는 all-states라 deleted_at 세팅된 채 200 반환
    r = await api.get(f"/api/v1/admin/vouchers/{voucher_id}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["deleted_at"] is not None


@pytest.mark.asyncio
async def test_admin_voucher_requires_admin_auth(api: AsyncClient):
    """admin 토큰 없이는 거부."""
    r = await api.get("/api/v1/admin/vouchers")
    assert r.status_code in (401, 403), r.text
