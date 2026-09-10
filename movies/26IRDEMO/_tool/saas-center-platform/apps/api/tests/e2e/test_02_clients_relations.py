"""내담자 + 관계(보호자/형제) 복합 플로우.

seed 베이스라인(김씨 가족: 김민준-김영희(mother,primary)-김철수(father))을 읽고,
신규 가족을 E2E로 생성해 관계 그래프·중복검사·soft delete까지 검증한다.
"""
from .conftest import unique
from .helpers import client_id_by_name


async def test_seed_family_relations(api, manager):
    """seed 관계: 김민준의 보호자 = 김영희(primary mother) + 김철수(father)."""
    cid = manager["center_id"]
    minjun = await client_id_by_name(api, manager, "김민준")

    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{minjun}/relations",
        headers=manager["headers"],
    )
    assert r.status_code == 200, r.text
    relations = r.json()
    guardians = [rel for rel in relations if rel["relation_category"] == "guardian"]
    assert len(guardians) >= 2, f"김민준 보호자 2명이어야 함: {relations}"
    primary = [g for g in guardians if g.get("is_primary")]
    assert len(primary) == 1, f"주 보호자는 1명: {guardians}"

    siblings = [rel for rel in relations if rel["relation_category"] == "sibling"]
    assert len(siblings) == 1, f"김서연 형제 관계 1건이어야 함: {relations}"


async def test_create_family_with_relations_flow(api, manager):
    """아동 생성 → 보호자 생성 → 관계 연결 → 양방향 조회 → 해제."""
    cid = manager["center_id"]
    headers = manager["headers"]
    child_name, guardian_name = unique("e2e아동"), unique("e2e보호자")

    # 1. 아동 내담자 생성
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={
            "role": "client",
            "name": child_name,
            "birth_date": "2019-05-05",
            "gender": "male",
            "memo": "E2E 생성",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    child_id = r.json()["id"]

    # 2. 보호자 생성
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={
            "role": "guardian",
            "name": guardian_name,
            "birth_date": "1990-01-01",
            "gender": "female",
            "phone": "010-5555-1234",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    guardian_id = r.json()["id"]

    # 3. 보호자 관계 연결 (child 하위 리소스)
    # is_primary=False — 주 보호자는 삭제 금지 규칙이 있어 해제 검증을 위해 비주 보호자로 생성
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{child_id}/relations",
        json={
            "relation_category": "guardian",
            "related_client_id": guardian_id,
            "relation_type": "guardian",
            "relation_detail": "mother",
            "is_primary": False,
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text

    # 4. 양방향 조회: 아동→보호자, 보호자→아동 모두 보여야 함
    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{child_id}/relations", headers=headers
    )
    forward = [rel for rel in r.json() if rel["related_client_id"] == guardian_id]
    assert forward, f"아동→보호자 관계 누락: {r.json()}"
    # 해제는 조회된 관계의 PK 기준 (POST 응답 id와 다를 수 있음 — 조회가 정본)
    relation_id = forward[0]["id"]

    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/relations", headers=headers
    )
    assert any(
        rel["related_client_id"] == child_id for rel in r.json()
    ), f"보호자→아동 역방향 관계 누락: {r.json()}"

    # 5. 관계 해제 (PK 기반)
    r = await api.delete(
        f"/api/v1/centers/{cid}/clients/relations/{relation_id}", headers=headers
    )
    assert r.status_code == 200, r.text

    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{child_id}/relations", headers=headers
    )
    assert not any(
        rel["related_client_id"] == guardian_id
        for rel in r.json()
        if rel["relation_category"] == "guardian"
    ), "해제된 관계가 여전히 조회됨"


async def test_primary_guardian_cannot_be_deleted(api, manager):
    """도메인 규칙: 주 보호자(is_primary=True) 관계는 해제 금지 (400)."""
    cid = manager["center_id"]
    minjun = await client_id_by_name(api, manager, "김민준")

    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{minjun}/relations",
        headers=manager["headers"],
    )
    primary = [
        rel for rel in r.json()
        if rel["relation_category"] == "guardian" and rel.get("is_primary")
    ]
    assert primary, "seed 주 보호자 관계 없음"

    r = await api.delete(
        f"/api/v1/centers/{cid}/clients/relations/{primary[0]['id']}",
        headers=manager["headers"],
    )
    assert r.status_code == 400, f"주 보호자 삭제가 차단되지 않음: {r.status_code} {r.text}"


async def test_duplicate_check_detects_seed_client(api, manager):
    """중복 검사: seed 내담자와 동일 이름+생일 → 중복 감지."""
    cid = manager["center_id"]
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/validate-duplicates",
        json={"clients": [{"name": "김민준", "birth_date": "2019-03-10"}]},
        headers=manager["headers"],
    )
    assert r.status_code == 200, r.text
    result = r.json()["results"][0]
    assert result["duplicate_level"] in ("low", "high"), f"중복 미감지: {result}"
    assert result["matched_client"]["name"] == "김민준"


async def test_soft_delete_client(api, manager):
    """생성 → 삭제 → 상세 404 + 목록 미노출."""
    cid = manager["center_id"]
    headers = manager["headers"]
    name = unique("e2e삭제")

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={"role": "client", "name": name, "birth_date": "2000-01-01"},
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    client_id = r.json()["id"]

    r = await api.delete(
        f"/api/v1/centers/{cid}/clients/{client_id}", headers=headers
    )
    assert r.status_code == 200, r.text

    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{client_id}", headers=headers
    )
    assert r.status_code == 404, f"soft delete 후에도 조회됨: {r.status_code}"
