"""
시나리오 2: 권한 아키텍처 검증 (access_level + owner_scope)

테스트 대상:
  - access_level=all (ADMIN/MANAGER/STAFF): 전체 데이터 조회
  - access_level=own (COUNSELOR): 본인 데이터만 조회
  - 권한 게이트: write:program, write:room, write:role 등 역할별 접근 제어
  - owner_scope 필터링: 일정, 상담 케이스, 문서

실행: uv run python tests/scenarios/run_scenario_02_permissions.py
"""
import asyncio
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text

from app.infrastructure.persistence.models import BaseModel
from app.main import app


TEST_DATABASE_URL = "postgresql+asyncpg://imomtae:imomtae_dev@localhost:3501/imomtae"


# ============================================================
# 헬퍼 함수
# ============================================================

async def signup_and_login(client: AsyncClient, email: str, name: str, phone: str) -> dict:
    """회원가입 + 로그인 → {access_token, headers, person_id, account_id}"""
    signup_data = {
        "email": email,
        "password": "Test1234!@",
        "person": {"name": name, "phone": phone, "birth": "1990-01-01", "gender": "male"},
    }
    r = await client.post("/api/v1/auth/signup", json=signup_data)
    assert r.status_code == 201, f"signup failed ({email}): {r.text}"
    data = r.json()

    token = data["access_token"]
    return {
        "access_token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "person_id": data["person"]["id"],
        "account_id": data["account"]["id"],
        "email": email,
        "name": name,
    }


async def create_center(client: AsyncClient, headers: dict) -> str:
    """센터 신청 + 승인 → center_id"""
    r = await client.post(
        "/api/v1/centers/applications/",
        json={
            "name": "권한테스트 상담센터",
            "phone": "02-0000-0000",
            "address": {"zip_code": "06234", "address": "서울시 강남구", "detail": "1층"},
            "description": "권한 아키텍처 테스트용",
            "business_registration_number": "999-99-99999",
            "representative_name": "테스트",
        },
        headers=headers,
    )
    assert r.status_code == 201, f"center application failed: {r.text}"
    app_id = r.json()["id"]

    r2 = await client.post(f"/api/v1/centers/applications/{app_id}/approve", json={})
    assert r2.status_code == 200, f"center approval failed: {r2.text}"
    return r2.json()["center_id"]


async def invite_and_accept(
    client: AsyncClient,
    center_id: str,
    admin_headers: dict,
    invitee: dict,
    role_code: str,
) -> str:
    """초대 생성(관리자) + 수락(본인) → member_id"""
    # 초대 생성
    r = await client.post(
        f"/api/v1/centers/{center_id}/members/invitations",
        json={"name": invitee["name"], "email": invitee["email"], "role_code": role_code, "employment_type": "FULLTIME"},
        headers=admin_headers,
    )
    assert r.status_code == 201, f"invitation create failed: {r.text}"
    invitation_id = r.json()["id"]

    # 초대 수락 (본인 토큰)
    r2 = await client.post(
        f"/api/v1/centers/{center_id}/members/invitations/{invitation_id}/accept",
        headers=invitee["headers"],
    )
    assert r2.status_code == 200, f"invitation accept failed: {r2.text}"
    return r2.json()["member_id"]


async def relogin(client: AsyncClient, email: str) -> dict:
    """재로그인하여 센터 정보 포함된 새 토큰 획득"""
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Test1234!@"},
    )
    assert r.status_code == 200, f"relogin failed ({email}): {r.text}"
    data = r.json()
    token = data["access_token"]
    return {
        "access_token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ============================================================
# TestRunner (scenario_01 패턴 재사용)
# ============================================================

class TestRunner:
    def __init__(self):
        self.engine = None
        self.client = None
        self.passed = 0
        self.failed = 0
        self.errors = []
        # 공유 컨텍스트 (setup에서 채워짐)
        self.center_id = None
        self.admin = None
        self.counselor_a = None
        self.counselor_b = None
        self.staff = None

    async def setup(self):
        print("\n" + "=" * 60)
        print("  시나리오 2: 권한 아키텍처 E2E 테스트")
        print("=" * 60)

        self.engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool, echo=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.drop_all)
            await conn.run_sync(BaseModel.metadata.create_all)
            print("  DB 테이블 생성 완료")

        self.async_session = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

        # Seed roles/permissions
        from scripts.seed.common.role import seed_roles, seed_permissions, seed_role_permissions
        async with self.async_session() as session:
            await seed_roles(session)
            await seed_permissions(session)
            await seed_role_permissions(session)
            await session.commit()
        print("  Seed 데이터 생성 완료")

        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test", follow_redirects=True)
        print("  테스트 클라이언트 준비 완료\n")

    async def setup_center_and_members(self):
        """공통 셋업: 센터 + 4명의 멤버 생성"""
        c = self.client
        print("-" * 60)
        print("  [Setup] 센터 생성 + 멤버 구성")
        print("-" * 60)

        # 1) 회원가입 (4명)
        self.admin = await signup_and_login(c, "admin@test.com", "관리자", "010-0000-0001")
        self.counselor_a = await signup_and_login(c, "counselor_a@test.com", "상담사A", "010-0000-0002")
        self.counselor_b = await signup_and_login(c, "counselor_b@test.com", "상담사B", "010-0000-0003")
        self.staff = await signup_and_login(c, "staff@test.com", "스태프", "010-0000-0004")
        print("   -> 4명 회원가입 완료")

        # 2) 센터 생성 (admin)
        self.center_id = await create_center(c, self.admin["headers"])
        print(f"   -> 센터 생성 완료 (ID: {self.center_id[:8]}...)")

        # 3) 재로그인 (admin - 센터 멤버십 반영)
        new_admin = await relogin(c, "admin@test.com")
        self.admin.update(new_admin)

        # 4) 초대 + 수락
        self.counselor_a["member_id"] = await invite_and_accept(
            c, self.center_id, self.admin["headers"], self.counselor_a, "COUNSELOR"
        )
        self.counselor_b["member_id"] = await invite_and_accept(
            c, self.center_id, self.admin["headers"], self.counselor_b, "COUNSELOR"
        )
        self.staff["member_id"] = await invite_and_accept(
            c, self.center_id, self.admin["headers"], self.staff, "STAFF"
        )
        print("   -> 3명 초대/수락 완료 (COUNSELOR x2, STAFF x1)")

        # 5) 재로그인 (모든 멤버 - 센터 멤버십 반영)
        for user in [self.counselor_a, self.counselor_b, self.staff]:
            new = await relogin(c, user["email"])
            user.update(new)
        print("   -> 전원 재로그인 완료")

        # 6) admin member_id 확인
        r = await c.get(
            f"/api/v1/centers/{self.center_id}/members/",
            headers=self.admin["headers"],
        )
        assert r.status_code == 200
        for m in r.json()["items"]:
            if m.get("person", {}).get("email") == "admin@test.com":
                self.admin["member_id"] = m["id"]
                break
        print(f"   -> ADMIN member_id: {self.admin['member_id'][:8]}...")
        print("   -> Setup 완료!\n")

    async def teardown(self):
        if self.client:
            await self.client.aclose()
        if self.engine:
            await self.engine.dispose()
        app.dependency_overrides.clear()

    async def run_test(self, test_func, name):
        print("-" * 60)
        print(f"  {name}")
        print("-" * 60)
        try:
            await test_func(self)
            self.passed += 1
            print(f"  => PASS\n")
        except AssertionError as e:
            self.failed += 1
            msg = f"  => FAIL: {e}"
            self.errors.append(f"{name}: {e}")
            print(msg + "\n")
        except Exception as e:
            self.failed += 1
            msg = f"  => ERROR: {type(e).__name__}: {e}"
            self.errors.append(f"{name}: {type(e).__name__}: {e}")
            print(msg + "\n")

    def print_summary(self):
        print("=" * 60)
        print(f"  결과: {self.passed} passed / {self.failed} failed (총 {self.passed + self.failed})")
        if self.errors:
            print()
            for err in self.errors:
                print(f"  FAIL  {err}")
        print("=" * 60 + "\n")
        return self.failed == 0


# ============================================================
# 테스트 시나리오
# ============================================================


async def test_01_schedule_owner_scope(runner: TestRunner):
    """
    일정 owner_scope 필터링

    - ADMIN이 상담사A, 상담사B 각각의 일정 생성
    - ADMIN(access_level=all): 전체 일정 조회
    - 상담사A(access_level=own): 본인 일정만 조회
    - 상담사B(access_level=own): 본인 일정만 조회
    - STAFF(access_level=all): 전체 일정 조회
    """
    c = runner.client
    cid = runner.center_id

    # 상담사A 일정 2개 생성 + member_id 직접 설정
    schedule_ids_a = []
    for i in range(2):
        r = await c.post(
            f"/api/v1/centers/{cid}/schedules",
            json={
                "schedule_type": "counseling",
                "title": f"상담사A 일정 {i + 1}",
                "start": f"2026-04-0{i + 1}T09:00:00",
                "end": f"2026-04-0{i + 1}T10:00:00",
            },
            headers=runner.admin["headers"],
        )
        assert r.status_code == 201, f"schedule create failed: {r.text}"
        schedule_ids_a.append(r.json()["id"])

    # 상담사B 일정 1개 생성
    r = await c.post(
        f"/api/v1/centers/{cid}/schedules",
        json={
            "schedule_type": "counseling",
            "title": "상담사B 일정 1",
            "start": "2026-04-03T09:00:00",
            "end": "2026-04-03T10:00:00",
        },
        headers=runner.admin["headers"],
    )
    assert r.status_code == 201, f"schedule create failed: {r.text}"
    schedule_id_b = r.json()["id"]

    # member_id 직접 설정 (create_schedule_with_response가 member_id를 사용하지 않으므로)
    async with runner.async_session() as session:
        for sid in schedule_ids_a:
            await session.execute(
                text("UPDATE schedules SET member_id = :mid WHERE id = :sid"),
                {"mid": runner.counselor_a["member_id"], "sid": sid},
            )
        await session.execute(
            text("UPDATE schedules SET member_id = :mid WHERE id = :sid"),
            {"mid": runner.counselor_b["member_id"], "sid": schedule_id_b},
        )
        await session.commit()
    print("   -> 상담사A 일정 2개 + 상담사B 일정 1개 생성 (member_id 설정)")

    params = {"start": "2026-04-01T00:00:00", "end": "2026-04-30T23:59:59"}

    # ADMIN → 전체 3개
    r = await c.get(f"/api/v1/centers/{cid}/schedules", params=params, headers=runner.admin["headers"])
    assert r.status_code == 200
    admin_schedules = r.json()
    assert len(admin_schedules) == 3, f"ADMIN should see 3 schedules, got {len(admin_schedules)}"
    print(f"   -> ADMIN 일정 조회: {len(admin_schedules)}개 (전체)")

    # 상담사A → 본인 2개만
    r = await c.get(f"/api/v1/centers/{cid}/schedules", params=params, headers=runner.counselor_a["headers"])
    assert r.status_code == 200
    ca_schedules = r.json()
    assert len(ca_schedules) == 2, f"COUNSELOR_A should see 2 schedules, got {len(ca_schedules)}"
    for s in ca_schedules:
        assert "상담사A" in s.get("title", ""), f"Unexpected schedule: {s.get('title')}"
    print(f"   -> 상담사A 일정 조회: {len(ca_schedules)}개 (본인만)")

    # 상담사B → 본인 1개만
    r = await c.get(f"/api/v1/centers/{cid}/schedules", params=params, headers=runner.counselor_b["headers"])
    assert r.status_code == 200
    cb_schedules = r.json()
    assert len(cb_schedules) == 1, f"COUNSELOR_B should see 1 schedule, got {len(cb_schedules)}"
    assert "상담사B" in cb_schedules[0].get("title", "")
    print(f"   -> 상담사B 일정 조회: {len(cb_schedules)}개 (본인만)")

    # STAFF(access_level=all) → 전체 3개
    r = await c.get(f"/api/v1/centers/{cid}/schedules", params=params, headers=runner.staff["headers"])
    assert r.status_code == 200
    staff_schedules = r.json()
    assert len(staff_schedules) == 3, f"STAFF should see 3 schedules, got {len(staff_schedules)}"
    print(f"   -> STAFF 일정 조회: {len(staff_schedules)}개 (전체 - access_level=all)")


async def test_02_counselor_cannot_override_member_ids(runner: TestRunner):
    """
    COUNSELOR가 member_ids 파라미터로 타인 일정 조회 시도 → 무시됨

    - 상담사A가 member_ids=상담사B로 요청
    - owner_scope에 의해 member_ids가 본인으로 강제 치환됨
    - 상담사B의 일정이 아닌 본인(A) 일정만 반환
    """
    c = runner.client
    cid = runner.center_id

    params = {
        "start": "2026-04-01T00:00:00",
        "end": "2026-04-30T23:59:59",
        "member_id": runner.counselor_b["member_id"],  # 타인 ID 시도 (query alias)
    }
    r = await c.get(f"/api/v1/centers/{cid}/schedules", params=params, headers=runner.counselor_a["headers"])
    assert r.status_code == 200
    schedules = r.json()

    # owner_scope 강제 치환 → 본인(A) 일정만 반환
    assert len(schedules) == 2, f"COUNSELOR_A should see own 2, got {len(schedules)}"
    for s in schedules:
        assert "상담사A" in s.get("title", "")
    print("   -> 상담사A가 member_ids=B로 요청해도 본인 일정만 반환됨")


async def test_03_permission_gate_programs(runner: TestRunner):
    """
    관리 기능 접근 제어 (write:program)

    - ADMIN → 프로그램 생성 가능 (201)
    - COUNSELOR → 프로그램 생성 불가 (403)
    - STAFF → 프로그램 생성 불가 (403)
    """
    c = runner.client
    cid = runner.center_id
    program_data = {
        "name": "테스트 프로그램",
        "description": "설명",
        "member_ids": [runner.admin["member_id"]],
        "program_type": "INDIVIDUAL",
        "price": 50000,
        "duration_minutes": 50,
    }

    # ADMIN → 201
    r = await c.post(f"/api/v1/centers/{cid}/programs", json=program_data, headers=runner.admin["headers"])
    assert r.status_code == 201, f"ADMIN program create should succeed: {r.status_code} {r.text}"
    print("   -> ADMIN 프로그램 생성: 201 OK")

    # COUNSELOR → 403
    r = await c.post(f"/api/v1/centers/{cid}/programs", json=program_data, headers=runner.counselor_a["headers"])
    assert r.status_code == 403, f"COUNSELOR should get 403, got {r.status_code}"
    print("   -> COUNSELOR 프로그램 생성: 403 Forbidden")

    # STAFF → 403
    r = await c.post(f"/api/v1/centers/{cid}/programs", json=program_data, headers=runner.staff["headers"])
    assert r.status_code == 403, f"STAFF should get 403, got {r.status_code}"
    print("   -> STAFF 프로그램 생성: 403 Forbidden")


async def test_04_permission_gate_rooms(runner: TestRunner):
    """
    관리 기능 접근 제어 (write:room)

    - ADMIN → 장소 생성 가능 (201)
    - COUNSELOR → 장소 생성 불가 (403)
    """
    c = runner.client
    cid = runner.center_id
    room_data = {"name": "상담실 1", "capacity": 4}

    # ADMIN → 201
    r = await c.post(f"/api/v1/centers/{cid}/rooms", json=room_data, headers=runner.admin["headers"])
    assert r.status_code == 201, f"ADMIN room create: {r.status_code} {r.text}"
    print("   -> ADMIN 장소 생성: 201 OK")

    # COUNSELOR → 403
    r = await c.post(f"/api/v1/centers/{cid}/rooms", json=room_data, headers=runner.counselor_a["headers"])
    assert r.status_code == 403, f"COUNSELOR should get 403, got {r.status_code}"
    print("   -> COUNSELOR 장소 생성: 403 Forbidden")


async def test_05_permission_gate_role_management(runner: TestRunner):
    """
    역할 관리 접근 제어 (write:role) — ADMIN만 가능

    - ADMIN → 역할 목록 조회 가능
    - COUNSELOR → 403
    - STAFF → 403
    """
    c = runner.client
    cid = runner.center_id

    # ADMIN → 200
    r = await c.get(f"/api/v1/centers/{cid}/roles", headers=runner.admin["headers"])
    assert r.status_code == 200, f"ADMIN roles: {r.status_code} {r.text}"
    roles_data = r.json()
    roles_count = len(roles_data) if isinstance(roles_data, list) else len(roles_data.get("items", []))
    print(f"   -> ADMIN 역할 목록 조회: 200 OK ({roles_count}개)")

    # COUNSELOR → 403
    r = await c.get(f"/api/v1/centers/{cid}/roles", headers=runner.counselor_a["headers"])
    assert r.status_code == 403, f"COUNSELOR should get 403, got {r.status_code}"
    print("   -> COUNSELOR 역할 목록 조회: 403 Forbidden")

    # STAFF → 403
    r = await c.get(f"/api/v1/centers/{cid}/roles", headers=runner.staff["headers"])
    assert r.status_code == 403, f"STAFF should get 403, got {r.status_code}"
    print("   -> STAFF 역할 목록 조회: 403 Forbidden")


async def test_06_counselor_crud_permissions(runner: TestRunner):
    """
    COUNSELOR의 CRUD 권한 확인

    - 일정 생성 가능 (write:schedule)
    - 내담자 생성 가능 (write:client)
    - 일정 삭제 가능 (delete:schedule)
    """
    c = runner.client
    cid = runner.center_id

    # 일정 생성 (write:schedule)
    r = await c.post(
        f"/api/v1/centers/{cid}/schedules",
        json={
            "schedule_type": "counseling",
            "title": "상담사A 직접 생성",
            "start": "2026-04-10T09:00:00",
            "end": "2026-04-10T10:00:00",
        },
        headers=runner.counselor_a["headers"],
    )
    assert r.status_code == 201, f"COUNSELOR schedule create: {r.status_code} {r.text}"
    schedule_id = r.json()["id"]
    print("   -> COUNSELOR 일정 생성: 201 OK")

    # 내담자 생성 (write:client)
    r = await c.post(
        f"/api/v1/centers/{cid}/clients",
        json={"role": "client", "name": "테스트 내담자", "birth_date": "2010-05-15", "gender": "male"},
        headers=runner.counselor_a["headers"],
    )
    assert r.status_code == 201, f"COUNSELOR client create: {r.status_code} {r.text}"
    print("   -> COUNSELOR 내담자 생성: 201 OK")

    # 일정 삭제 (delete:schedule)
    r = await c.delete(
        f"/api/v1/centers/{cid}/schedules/{schedule_id}",
        headers=runner.counselor_a["headers"],
    )
    assert r.status_code == 200, f"COUNSELOR schedule delete: {r.status_code} {r.text}"
    print("   -> COUNSELOR 일정 삭제: 200 OK")


async def test_07_staff_cannot_delete_client(runner: TestRunner):
    """
    STAFF는 delete:client 권한이 없음

    - 내담자 생성 가능 (write:client)
    - 내담자 삭제 불가 (delete:client 없음 → 403)
    """
    c = runner.client
    cid = runner.center_id

    # 내담자 생성
    r = await c.post(
        f"/api/v1/centers/{cid}/clients",
        json={"role": "client", "name": "스태프 등록 내담자", "birth_date": "2012-01-01", "gender": "female"},
        headers=runner.staff["headers"],
    )
    assert r.status_code == 201, f"STAFF client create: {r.status_code} {r.text}"
    client_id = r.json()["id"]
    print("   -> STAFF 내담자 생성: 201 OK")

    # 내담자 삭제 시도 → 403
    r = await c.delete(
        f"/api/v1/centers/{cid}/clients/{client_id}",
        headers=runner.staff["headers"],
    )
    assert r.status_code == 403, f"STAFF should get 403 on delete, got {r.status_code}"
    print("   -> STAFF 내담자 삭제: 403 Forbidden")


async def test_08_staff_cannot_write_counseling(runner: TestRunner):
    """
    STAFF는 write:counseling 권한이 없음

    - 상담 케이스 생성(intake) 불가 (403)
    - 상담 조회는 가능 (read:counseling 있음)
    """
    c = runner.client
    cid = runner.center_id

    # 상담 접수(intake) 시도 → 403
    r = await c.post(
        f"/api/v1/centers/{cid}/counseling/intake",
        json={
            "case": {
                "program_id": "dummy-program-id",
                "client_ids": ["dummy-client-id"],
                "counselor_ids": [runner.counselor_a["member_id"]],
                "chief_complaint": "테스트",
            },
            "sessions": {
                "start": "2026-05-01T09:00:00",
                "room_id": "dummy-room-id",
                "duration_minutes": 50,
            },
        },
        headers=runner.staff["headers"],
    )
    assert r.status_code == 403, f"STAFF counseling intake should get 403, got {r.status_code}"
    print("   -> STAFF 상담 접수: 403 Forbidden")

    # 상담 목록 조회는 가능 (read:counseling)
    r = await c.get(f"/api/v1/centers/{cid}/counseling", headers=runner.staff["headers"])
    assert r.status_code == 200, f"STAFF counseling list should succeed: {r.status_code} {r.text}"
    print("   -> STAFF 상담 목록 조회: 200 OK")


async def test_09_unauthenticated_access(runner: TestRunner):
    """
    인증 없는 요청은 401 반환

    - 토큰 없이 일정 조회 시도
    - 잘못된 토큰으로 요청 시도
    """
    c = runner.client
    cid = runner.center_id
    params = {"start": "2026-04-01T00:00:00", "end": "2026-04-30T23:59:59"}

    # 토큰 없음 → 401
    r = await c.get(f"/api/v1/centers/{cid}/schedules", params=params)
    assert r.status_code in (401, 403), f"No token should get 401/403, got {r.status_code}"
    print(f"   -> 토큰 없이 일정 조회: {r.status_code}")

    # 잘못된 토큰 → 401
    r = await c.get(
        f"/api/v1/centers/{cid}/schedules",
        params=params,
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert r.status_code == 401, f"Invalid token should get 401, got {r.status_code}"
    print(f"   -> 잘못된 토큰 일정 조회: {r.status_code}")


async def test_10_counselor_no_access_to_invitation(runner: TestRunner):
    """
    COUNSELOR는 write:member_invitation 권한이 없음

    - 초대 생성 불가 (403)
    """
    c = runner.client
    cid = runner.center_id

    r = await c.post(
        f"/api/v1/centers/{cid}/members/invitations",
        json={"name": "새멤버", "email": "new@test.com", "role_code": "COUNSELOR", "employment_type": "FULLTIME"},
        headers=runner.counselor_a["headers"],
    )
    assert r.status_code == 403, f"COUNSELOR invitation create should get 403, got {r.status_code}"
    print("   -> COUNSELOR 멤버 초대: 403 Forbidden")

    # STAFF도 마찬가지
    r = await c.post(
        f"/api/v1/centers/{cid}/members/invitations",
        json={"name": "새멤버2", "email": "new2@test.com", "role_code": "STAFF", "employment_type": "FULLTIME"},
        headers=runner.staff["headers"],
    )
    assert r.status_code == 403, f"STAFF invitation create should get 403, got {r.status_code}"
    print("   -> STAFF 멤버 초대: 403 Forbidden")


async def test_11_access_level_in_login_response(runner: TestRunner):
    """
    로그인 응답에 role_code 확인

    - ADMIN: role_code=ADMIN
    - COUNSELOR: role_code=COUNSELOR
    """
    c = runner.client

    r = await c.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "Test1234!@"})
    assert r.status_code == 200
    centers = r.json().get("centers", [])
    assert len(centers) >= 1
    assert centers[0]["role_code"] == "ADMIN"
    print(f"   -> ADMIN 로그인: role_code={centers[0]['role_code']}")

    r = await c.post("/api/v1/auth/login", json={"email": "counselor_a@test.com", "password": "Test1234!@"})
    assert r.status_code == 200
    centers = r.json().get("centers", [])
    assert len(centers) >= 1
    assert centers[0]["role_code"] == "COUNSELOR"
    print(f"   -> COUNSELOR 로그인: role_code={centers[0]['role_code']}")


# ============================================================
# 메인 실행
# ============================================================

async def main():
    runner = TestRunner()

    try:
        await runner.setup()
        await runner.setup_center_and_members()

        tests = [
            (test_01_schedule_owner_scope, "01. 일정 owner_scope 필터링 (ADMIN=전체, COUNSELOR=본인, STAFF=전체)"),
            (test_02_counselor_cannot_override_member_ids, "02. COUNSELOR member_ids 파라미터 무시 (owner_scope 강제)"),
            (test_03_permission_gate_programs, "03. 프로그램 관리 접근 제어 (write:program)"),
            (test_04_permission_gate_rooms, "04. 장소 관리 접근 제어 (write:room)"),
            (test_05_permission_gate_role_management, "05. 역할 관리 접근 제어 (write:role)"),
            (test_06_counselor_crud_permissions, "06. COUNSELOR CRUD 권한 확인"),
            (test_07_staff_cannot_delete_client, "07. STAFF 내담자 삭제 불가 (delete:client 없음)"),
            (test_08_staff_cannot_write_counseling, "08. STAFF 상담 접수 불가 (write:counseling 없음)"),
            (test_09_unauthenticated_access, "09. 인증 없는 요청 차단 (401)"),
            (test_10_counselor_no_access_to_invitation, "10. COUNSELOR/STAFF 멤버 초대 불가 (write:member_invitation 없음)"),
            (test_11_access_level_in_login_response, "11. 로그인 응답 role_code 확인"),
        ]

        for func, name in tests:
            await runner.run_test(func, name)

        success = runner.print_summary()
        sys.exit(0 if success else 1)

    finally:
        await runner.teardown()


if __name__ == "__main__":
    asyncio.run(main())
