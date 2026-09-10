"""E2E 쓰기 라우터 emit 배선 sanity — 대표 3종.

behavior/eventing 전환으로 쓰기 핸들러가 `emit()`을 호출한다. emit은 `event_group_id`(str)를
요구하고, 라우터가 `start_event_group()`을 선언해야 ctx에 채워진다 — 없으면 None →
`@typecheck`(core/type.py) → DevelopError 500. 마이그레이션 완료 후 발행 라우터는 전부 배선됨.
여기선 대표 3종으로 빠르게 고정한다(전 발행 모듈 create/update/delete 배선 망라는 test_15).
"""
from .conftest import unique


# emit + 배선 → 201
async def test_create_client_emits_ok(api, admin):
    """client/profile: start_event_group()+dispatch_events() 배선 → emit 통과."""
    cid = admin["center_id"]
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={"role": "client", "name": unique("e2e검증아동"), "gender": "male"},
        headers=admin["headers"],
    )
    assert r.status_code in (200, 201), f"배선된 라우터인데 실패: {r.status_code} {r.text}"


# emit + 배선 → 201
async def test_create_room_emits_ok(api, admin):
    """center/room: create_room_handler가 emit, 라우터 배선됨 → 201."""
    cid = admin["center_id"]
    r = await api.post(
        f"/api/v1/centers/{cid}/rooms/",
        json={"name": unique("e2e상담실")},
        headers=admin["headers"],
    )
    assert r.status_code == 201, f"룸 생성은 201이어야 — 실제: {r.status_code}\n{r.text}"


# emit 없음(application 위임) → 201
async def test_create_program_ok(api, admin):
    """center/program: application 핸들러로 위임, 그 경로는 emit하지 않아 통과.

    emit하지 않는 쓰기는 배선과 무관함을 고정(대조군). 담당자 1명 조회해 페이로드 구성.
    """
    cid = admin["center_id"]
    headers = admin["headers"]

    m = await api.get(f"/api/v1/centers/{cid}/members/", headers=headers)
    assert m.status_code == 200, f"멤버 조회 실패: {m.status_code} {m.text}"
    members = m.json()["items"]
    assert members, "seed 멤버가 있어야 함"
    member_id = members[0]["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/programs/",
        json={
            "name": unique("e2e프로그램"),
            "member_ids": [member_id],
            "program_type": "INDIVIDUAL",
            "price": 50000,
            "duration_minutes": 50,
        },
        headers=headers,
    )
    assert r.status_code == 201, f"프로그램 생성은 201이어야 — 실제: {r.status_code}\n{r.text}"
