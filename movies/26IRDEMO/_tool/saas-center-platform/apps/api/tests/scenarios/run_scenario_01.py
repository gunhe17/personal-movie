"""
시나리오 1: 회원가입 → 센터 신청 → 승인

pytest 없이 asyncio로 직접 실행하는 E2E 테스트
실행: uv run python tests/scenarios/run_scenario_01.py
"""
import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text

from app.infrastructure.persistence.models import BaseModel
from app.main import app


# Test database URL
TEST_DATABASE_URL = "postgresql+asyncpg://imomtae:imomtae_dev@localhost:3501/imomtae"


class TestRunner:
    """E2E 테스트 러너"""

    def __init__(self):
        self.engine = None
        self.session = None
        self.client = None
        self.passed = 0
        self.failed = 0
        self.errors = []

    async def setup(self):
        """테스트 환경 설정"""
        print("\n" + "=" * 60)
        print("🚀 테스트 환경 초기화 중...")
        print("=" * 60)

        # Engine 생성
        self.engine = create_async_engine(
            TEST_DATABASE_URL,
            poolclass=NullPool,
            echo=False,
        )

        # 테이블 생성
        async with self.engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.drop_all)
            await conn.run_sync(BaseModel.metadata.create_all)
            print("✅ 데이터베이스 테이블 생성 완료")

        # Session maker
        self.async_session = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        # Seed data (roles)
        await self._seed_roles()

        # HTTP Client
        transport = ASGITransport(app=app)
        self.client = AsyncClient(transport=transport, base_url="http://test")

        print("✅ 테스트 클라이언트 준비 완료\n")

    async def _seed_roles(self):
        """역할 및 권한 시드 데이터 생성"""
        from scripts.seed.common.role import seed_roles, seed_permissions, seed_role_permissions

        async with self.async_session() as session:
            await seed_roles(session)
            await seed_permissions(session)
            await seed_role_permissions(session)
            await session.commit()

        print("✅ Seed 데이터 생성 완료 (Roles, Permissions)")

    async def cleanup_data(self):
        """테스트 간 데이터 정리"""
        async with self.engine.begin() as conn:
            # Disable FK checks
            await conn.execute(text("SET session_replication_role = 'replica'"))

            # Truncate all tables except roles/permissions
            for table in reversed(BaseModel.metadata.sorted_tables):
                if table.name not in ('roles', 'permissions', 'role_permissions'):
                    await conn.execute(text(f"TRUNCATE TABLE {table.name} CASCADE"))

            # Re-enable FK checks
            await conn.execute(text("SET session_replication_role = 'origin'"))

    async def teardown(self):
        """테스트 환경 정리"""
        if self.client:
            await self.client.aclose()
        if self.engine:
            await self.engine.dispose()

        app.dependency_overrides.clear()

        print("\n" + "=" * 60)
        print("🧹 테스트 환경 정리 완료 (데이터는 DB에 유지됨)")
        print("=" * 60)

    async def run_test(self, test_func, name, cleanup_before=True):
        """개별 테스트 실행"""
        # 테스트 실행 전 데이터 정리 (선택적)
        if cleanup_before:
            await self.cleanup_data()

        print("\n" + "-" * 60)
        print(f"🧪 {name}")
        print("-" * 60)

        try:
            await test_func(self)  # runner 전달
            self.passed += 1
            print(f"✅ 테스트 통과: {name}")
        except AssertionError as e:
            self.failed += 1
            error_msg = f"❌ 테스트 실패: {name}\n   {str(e)}"
            self.errors.append(error_msg)
            print(error_msg)
        except Exception as e:
            self.failed += 1
            error_msg = f"💥 테스트 에러: {name}\n   {type(e).__name__}: {str(e)}"
            self.errors.append(error_msg)
            print(error_msg)

    def print_summary(self):
        """테스트 결과 요약 출력"""
        print("\n" + "=" * 60)
        print("📊 테스트 결과 요약")
        print("=" * 60)
        print(f"✅ 통과: {self.passed}")
        print(f"❌ 실패: {self.failed}")
        print(f"📝 총 테스트: {self.passed + self.failed}")

        if self.errors:
            print("\n" + "=" * 60)
            print("❌ 실패한 테스트 상세")
            print("=" * 60)
            for error in self.errors:
                print(error)

        print("=" * 60 + "\n")

        return self.failed == 0


async def test_01_signup_center_application_approval_flow(runner: TestRunner):
    """
    시나리오 1: 회원가입 → 센터 신청 → 승인

    플로우:
    1. 회원가입 (Account + Person 생성)
    2. 로그인 (AccessToken 획득)
    3. 센터 신청 (CenterApplication 생성)
    4. 플랫폼 관리자가 승인 (Center + Member 생성)
    5. 승인 후 센터 정보 확인
    """
    # ========================================
    # Step 1: 회원가입
    # ========================================
    signup_data = {
        "email": "test@example.com",
        "password": "SecurePass123!",
        "person": {
            "name": "김철수",
            "phone": "010-1234-5678",
            "birth": "1990-05-15",
            "gender": "male"
        }
    }

    response = await runner.client.post("/api/v1/auth/signup", json=signup_data)
    assert response.status_code == 201, f"회원가입 실패: {response.text}"

    signup_result = response.json()
    assert signup_result["account"]["email"] == "test@example.com"
    assert signup_result["person"]["name"] == "김철수"

    person_id = signup_result["person"]["id"]
    account_id = signup_result["account"]["id"]

    print(f"   ✓ Step 1: 회원가입 성공 (Account ID: {account_id})")

    # ========================================
    # Step 2: 로그인
    # ========================================
    login_data = {
        "email": "test@example.com",
        "password": "SecurePass123!"
    }

    response = await runner.client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200, f"로그인 실패: {response.text}"

    login_result = response.json()
    assert "access_token" in login_result
    assert login_result["token_type"].lower() == "bearer"

    access_token = login_result["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    print(f"   ✓ Step 2: 로그인 성공")

    # ========================================
    # Step 3: 센터 신청
    # ========================================
    center_application_data = {
        "name": "마음치유 심리상담센터",
        "phone": "02-1234-5678",
        "address": {
            "zip_code": "06234",
            "address": "서울특별시 강남구 테헤란로 123",
            "detail": "스타빌딩 5층"
        },
        "description": "청소년 및 성인 심리상담 전문센터입니다.",
        "business_registration_number": "123-45-67890",
        "representative_name": "김상담"
    }

    response = await runner.client.post(
        "/api/v1/centers/applications/",
        json=center_application_data,
        headers=headers
    )
    assert response.status_code == 201, f"센터 신청 실패: {response.text}"

    application_result = response.json()
    assert application_result["name"] == "마음치유 심리상담센터"
    assert application_result["status"] == "PENDING"

    application_id = application_result["id"]

    print(f"   ✓ Step 3: 센터 신청 성공 (Application ID: {application_id})")

    # ========================================
    # Step 4: 센터 승인
    # ========================================
    approval_data = {
        "logo_url": "https://example.com/logos/center_logo.png"
    }

    response = await runner.client.post(
        f"/api/v1/centers/applications/{application_id}/approve",
        json=approval_data
    )
    assert response.status_code == 200, f"센터 승인 실패: {response.text}"

    approved_result = response.json()
    assert approved_result["status"] == "APPROVED"
    assert approved_result["center_id"] is not None

    center_id = approved_result["center_id"]

    print(f"   ✓ Step 4: 센터 승인 성공 (Center ID: {center_id})")

    # ========================================
    # Step 5: 센터 정보 확인
    # ========================================
    response = await runner.client.get(
        f"/api/v1/centers/{center_id}",
        headers=headers
    )
    assert response.status_code == 200, f"센터 조회 실패: {response.text}"

    center_result = response.json()
    assert center_result["id"] == center_id
    assert center_result["name"] == "마음치유 심리상담센터"

    print(f"   ✓ Step 5: 센터 정보 확인 성공")

    # ========================================
    # Step 6: 재로그인 (센터 정보 포함된 토큰)
    # ========================================
    response = await runner.client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200, f"재로그인 실패: {response.text}"

    new_login_result = response.json()
    new_access_token = new_login_result["access_token"]
    new_headers = {"Authorization": f"Bearer {new_access_token}"}

    print(f"   ✓ Step 6: 재로그인 성공 (센터 정보 포함)")

    # ========================================
    # Step 7: 센터 멤버 확인
    # ========================================
    response = await runner.client.get(
        f"/api/v1/centers/{center_id}/members/",
        headers=new_headers
    )
    assert response.status_code == 200, f"멤버 조회 실패: {response.text}"

    members_response = response.json()
    assert members_response["total"] == 1, "신청자가 멤버로 자동 추가되어야 함"

    members = members_response["items"]
    assert len(members) == 1
    assert members[0]["person"]["id"] == person_id
    assert members[0]["role_id"] == 1  # ADMIN 역할

    print(f"   ✓ Step 7: 센터 멤버 확인 성공 (멤버 수: {members_response['total']})")


async def test_02_signup_duplicate_email(runner: TestRunner):
    """중복 이메일 회원가입 시도 테스트"""
    signup_data = {
        "email": "duplicate@example.com",
        "password": "SecurePass123!",
        "person": {
            "name": "김철수",
            "phone": "010-9999-0001",
            "birth": "1990-05-15",
            "gender": "male"
        }
    }

    # 첫 번째 회원가입 (성공)
    response = await runner.client.post("/api/v1/auth/signup", json=signup_data)
    assert response.status_code == 201, f"첫 번째 회원가입 실패: {response.text}"
    print(f"   ✓ 첫 번째 회원가입 성공")

    # 두 번째 회원가입 (중복 이메일 - 실패)
    response = await runner.client.post("/api/v1/auth/signup", json=signup_data)
    assert response.status_code == 409, f"중복 이메일 검증 실패: {response.status_code}"
    assert "이미 사용 중입니다" in response.json()["detail"]
    print(f"   ✓ 중복 이메일 차단 확인")


async def test_03_center_application_without_auth(runner: TestRunner):
    """인증 없이 센터 신청 시도 테스트"""
    center_application_data = {
        "name": "테스트 센터",
        "phone": "02-1234-5678"
    }

    response = await runner.client.post(
        "/api/v1/centers/applications/",
        json=center_application_data
    )
    assert response.status_code == 401, f"인증 없는 요청 차단 실패: {response.status_code}"
    print(f"   ✓ 인증 없는 센터 신청 차단 확인")


async def test_04_invalid_login(runner: TestRunner):
    """잘못된 비밀번호로 로그인 시도 테스트"""
    # 회원가입
    signup_data = {
        "email": "logintest@example.com",
        "password": "CorrectPass123!",
        "person": {
            "name": "김철수",
            "phone": "010-9999-0002",
            "birth": "1990-05-15",
            "gender": "male"
        }
    }
    response = await runner.client.post("/api/v1/auth/signup", json=signup_data)
    assert response.status_code == 201, f"회원가입 실패: {response.text}"
    print(f"   ✓ 회원가입 성공")

    # 잘못된 비밀번호로 로그인 시도
    login_data = {
        "email": "logintest@example.com",
        "password": "WrongPassword123!"
    }
    response = await runner.client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 401, f"잘못된 비밀번호 차단 실패: {response.status_code}"
    print(f"   ✓ 잘못된 비밀번호 로그인 차단 확인")


async def main():
    """메인 테스트 실행"""
    runner = TestRunner()

    try:
        # Setup
        await runner.setup()

        # Run tests (첫 테스트만 cleanup, 나머지는 데이터 누적)
        await runner.run_test(
            test_01_signup_center_application_approval_flow,
            "시나리오 1: 회원가입 → 센터 신청 → 승인",
            cleanup_before=True  # 첫 테스트만 cleanup
        )

        await runner.run_test(
            test_02_signup_duplicate_email,
            "시나리오 2: 중복 이메일 회원가입 시도",
            cleanup_before=False  # 데이터 누적
        )

        await runner.run_test(
            test_03_center_application_without_auth,
            "시나리오 3: 인증 없이 센터 신청 시도",
            cleanup_before=False  # 데이터 누적
        )

        await runner.run_test(
            test_04_invalid_login,
            "시나리오 4: 잘못된 비밀번호 로그인 시도",
            cleanup_before=False  # 데이터 누적
        )

        # Summary
        success = runner.print_summary()

        # Exit code
        sys.exit(0 if success else 1)

    finally:
        await runner.teardown()


if __name__ == "__main__":
    asyncio.run(main())
