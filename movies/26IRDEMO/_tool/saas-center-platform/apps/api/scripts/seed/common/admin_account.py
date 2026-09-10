"""플랫폼 어드민 초기 계정 시드 스크립트

초기 system_admin + super_admin 계정을 생성합니다.
이미 존재하면 건너뜁니다.
"""
import asyncio
from uuid import uuid4

from sqlalchemy import select

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.hash.factory import get_password_hasher
from app.modules.platform_admin.admin_account.models import AdminAccount, AdminRole


# 초기 시드 계정 목록
# system_admin 역할은 deprecated — super_admin이 최고 권한 역할
INITIAL_ACCOUNTS = [
    {
        "email": "admin@insighter.co.kr",
        "password": "SystemAdmin1234!@",
        "name": "관리자",
        "role": AdminRole.ADMIN,
    },
    {
        "email": "imomtae@insighter.co.kr",
        "password": "SuperAdmin1234!@",
        "name": "플랫폼 관리자",
        "role": AdminRole.SUPER_ADMIN,
    },
]


async def _seed_account(session, account_config: dict):
    """단일 계정 시드 (이미 존재하면 건너뜀)"""
    stmt = select(AdminAccount).where(
        AdminAccount.email == account_config["email"]
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        print(f"  ⏭️  {account_config['role']} 이미 존재: {existing.email}")
        return

    admin = AdminAccount(
        id=str(uuid4()),
        email=account_config["email"],
        password=get_password_hasher().hash(value=account_config["password"]),
        name=account_config["name"],
        role=account_config["role"],
        is_active=True,
        token_version=0,
        failed_login_count=0,
    )
    session.add(admin)
    print(f"  ✅ {account_config['role']} 생성 완료: {admin.email} (id: {admin.id})")


async def main():
    async with AsyncSessionLocal() as session:
        for account_config in INITIAL_ACCOUNTS:
            await _seed_account(session, account_config)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
