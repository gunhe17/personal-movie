"""Admin 센터 신청 승인 E2E.

승인은 크로스모듈 초기화(Center 생성 + CenterAssessment + Role + 운영시간 + Trial 구독 + AdminMember)를
한 트랜잭션으로 처리한다. 리팩토링 전 현재 동작을 엔드포인트 기준으로 고정한다.

신청 제출(submit) 엔드포인트가 따로 없어 PENDING 신청은 DB에 직접 생성한다.
admin 2FA는 토큰을 직접 발급해 우회한다(test_06과 동일 패턴).
"""
import pytest
from httpx import AsyncClient

from tests.e2e.test_06_voucher_admin_flow import admin_headers


async def _create_pending_application() -> tuple[str, str]:
    """신청자 Account+Person + PENDING CenterApplication 생성. Returns (application_id, person_id)."""
    from sqlalchemy import select
    from app.infrastructure.persistence.database import AsyncSessionLocal
    from app.infrastructure.hash.factory import get_password_hasher
    from app.modules.auth.account.models import Account
    from app.modules.person.person.models import Person
    from app.modules.center.center_application.models import CenterApplication
    from scripts.seed.develop import gen_id

    async with AsyncSessionLocal() as s:
        account_id = gen_id()
        person_id = gen_id()
        application_id = gen_id()

        s.add(Account(
            id=account_id,
            email=f"applicant-{account_id}@test.com",
            password=get_password_hasher().hash(value="test1234"),
            provider="email",
            is_active=True,
            is_verified=True,
            token_version=0,
        ))
        s.add(Person(
            id=person_id,
            account_id=account_id,
            name="신청자",
            phone="010-7000-0001",
        ))
        s.add(CenterApplication(
            id=application_id,
            created_by=account_id,
            name="E2E 승인센터",
            phone="02-1234-5678",
            status="PENDING",
        ))
        await s.commit()
    return application_id, person_id


@pytest.mark.asyncio
async def test_admin_center_application_approve_flow(api: AsyncClient):
    headers = await admin_headers()
    application_id, person_id = await _create_pending_application()

    # 1. 승인 → 200 + center_id 반환
    r = await api.post(
        f"/api/v1/admin/center-applications/{application_id}/approve",
        headers=headers,
    )
    assert r.status_code == 200, r.text
    center_id = r.json()["center_id"]
    assert center_id

    # 2. 크로스모듈 초기화 결과 검증 (Center / CenterAssessment / ADMIN Role / AdminMember)
    from sqlalchemy import select, func
    from app.infrastructure.persistence.database import AsyncSessionLocal
    from app.modules.center.center.models import Center
    from app.modules.center.member.models import Member
    from app.modules.role.role.models import Role
    from app.modules.assessment.center_assessment.models import CenterAssessment

    async with AsyncSessionLocal() as s:
        center = (await s.execute(select(Center).where(Center.id == center_id))).scalar_one()
        assert center.name == "E2E 승인센터"

        assessment_count = (await s.execute(
            select(func.count()).select_from(CenterAssessment).where(
                CenterAssessment.center_id == center_id
            )
        )).scalar_one()
        assert assessment_count > 0

        admin_role = (await s.execute(
            select(Role).where(Role.center_id == center_id, Role.code == "ADMIN")
        )).scalar_one()

        member = (await s.execute(
            select(Member).where(
                Member.center_id == center_id, Member.person_id == person_id
            )
        )).scalar_one()
        assert member.role_id == admin_role.id

    # 3. 멱등성: 이미 승인된 신청 재승인은 거부 (PENDING 아님)
    r = await api.post(
        f"/api/v1/admin/center-applications/{application_id}/approve",
        headers=headers,
    )
    assert r.status_code in (400, 409, 422), r.text


@pytest.mark.asyncio
async def test_admin_center_application_reject_flow(api: AsyncClient):
    headers = await admin_headers()
    application_id, _ = await _create_pending_application()

    # 1. 거절 → 200
    r = await api.post(
        f"/api/v1/admin/center-applications/{application_id}/reject",
        headers=headers,
        json={"reason": "서류 미비"},
    )
    assert r.status_code == 200, r.text

    # 2. 상태가 PENDING 이 아니므로 승인 시도는 거부
    r = await api.post(
        f"/api/v1/admin/center-applications/{application_id}/approve",
        headers=headers,
    )
    assert r.status_code in (400, 409, 422), r.text
