"""스모크: 앱 부팅·인증·seed 베이스라인이 살아 있는지 가장 먼저 검증한다.

여기가 깨지면 나머지 E2E는 의미가 없다.
"""
from .conftest import SEED_USERS, login_as


async def test_health(api):
    r = await api.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


async def test_openapi_contract_loads(api):
    """OpenAPI 스키마 생성 = 전체 라우터/스키마의 import·정합성 검증."""
    r = await api.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    assert len(paths) > 300, f"라우트 수가 비정상적으로 적음: {len(paths)}"


async def test_all_seed_accounts_can_login(api):
    for key in SEED_USERS:
        session = await login_as(api, key)
        assert session["account_id"]
        if key == "staff":
            # seed 베이스라인: STAFF 역할이 센터 role에 없어 멤버 미생성 → 센터 무소속
            assert session["center_id"] is None
        else:
            assert session["center_id"], f"{key}는 센터 소속이어야 함"


async def test_login_wrong_password_rejected(api):
    r = await api.post(
        "/api/v1/auth/login",
        json={"email": "manager@mindscope.com", "password": "wrong-password"},
    )
    assert r.status_code == 401


async def test_protected_route_requires_token(api, manager):
    center_id = manager["center_id"]
    r = await api.get(f"/api/v1/centers/{center_id}/clients/")
    assert r.status_code == 401


async def test_seed_clients_baseline(api, manager):
    """seed 내담자 7명(김민준/김영희/김철수/김서연/이하준/이수진/박지우)이 조회된다."""
    center_id = manager["center_id"]
    r = await api.get(
        f"/api/v1/centers/{center_id}/clients/",
        params={"page": 1, "size": 50},
        headers=manager["headers"],
    )
    assert r.status_code == 200, r.text
    body = r.json()
    names = {item["name"] for item in body["items"]}
    assert {"김민준", "김영희", "박지우"} <= names, f"seed 내담자 누락: {names}"
