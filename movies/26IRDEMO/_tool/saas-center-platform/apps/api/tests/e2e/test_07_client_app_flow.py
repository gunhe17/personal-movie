"""내담자 앱(마인드스코프) 연결·읽기 투영 플로우.

웹(스탭) 초대 코드 발급 → 앱 가입 → 코드 검증(비소모) → 아이 확인·연결(claim)
→ me/일정/진행 read-projection → 해제까지. 토큰 audience 교차 차단도 검증한다.
"""
from .conftest import unique


async def _create_guardian_with_child(api, manager) -> tuple[str, str, str]:
    cid = manager["center_id"]
    headers = manager["headers"]
    child_name, guardian_name = unique("앱아동"), unique("앱보호자")

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={
            "role": "client",
            "name": child_name,
            "birth_date": "2020-03-01",
            "gender": "male",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    child_id = r.json()["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={
            "role": "guardian",
            "name": guardian_name,
            "birth_date": "1991-01-01",
            "gender": "female",
            "phone": "010-7777-0001",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    guardian_id = r.json()["id"]

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

    return guardian_id, child_id, child_name


async def _app_signup(api) -> dict:
    import random

    email = f"{unique('appuser')}@example.com"
    # Person.phone 유니크 — 가입마다 고유 번호
    phone = f"010-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
    r = await api.post(
        "/api/v1/app/auth/signup",
        json={
            "email": email,
            "password": "AppPass123!",
            "name": unique("보호자"),
            "phone": phone,
        },
    )
    assert r.status_code == 201, r.text
    tokens = r.json()
    return {
        "email": email,
        "headers": {"Authorization": f"Bearer {tokens['access_token']}"},
        **tokens,
    }


async def test_client_app_full_link_flow(api, manager):
    cid = manager["center_id"]
    guardian_id, child_id, child_name = await _create_guardian_with_child(api, manager)

    # 1. 스탭이 초대 코드 발급 (보호자 단위)
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/invitations",
        headers=manager["headers"],
    )
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    assert len(code) == 6 and code.isdigit()

    # 발급 상태 = invited
    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/status",
        headers=manager["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "invited"

    # 2. 앱 가입 (audience=client_app 토큰)
    app_user = await _app_signup(api)

    # 교차 차단: 앱 토큰으로 직원 표면 접근 불가
    r = await api.get("/api/v1/auth/me", headers=app_user["headers"])
    assert r.status_code == 401, r.text

    # 교차 차단: 직원 토큰으로 앱 표면 접근 불가
    r = await api.get("/api/v1/app/me", headers=manager["headers"])
    assert r.status_code == 401, r.text

    # 3. 코드 검증 (비소모 열람)
    r = await api.post(
        "/api/v1/app/link-invitations/verify",
        json={"code": code},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    verify = r.json()
    assert any(c["client_id"] == child_id for c in verify["children"]), verify
    child_candidate = next(c for c in verify["children"] if c["client_id"] == child_id)
    assert child_candidate["name"] == child_name
    assert child_candidate["is_self"] is False

    # 재열람 가능 (수락 전까지 비소모)
    r = await api.post(
        "/api/v1/app/link-invitations/verify",
        json={"code": code},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text

    # 4. 아이 확인 → 연결 (새 프로필)
    r = await api.post(
        "/api/v1/app/links/claim",
        json={
            "code": code,
            "mappings": [
                {"client_id": child_id, "new_profile": {"display_name": child_name}}
            ],
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    links = r.json()["links"]
    assert len(links) == 1
    assert links[0]["status"] == "active"
    assert links[0]["client_id"] == child_id
    link_id = links[0]["id"]
    profile_id = links[0]["profile_id"]

    # 수락 완료 = 코드 소모
    r = await api.post(
        "/api/v1/app/link-invitations/verify",
        json={"code": code},
        headers=app_user["headers"],
    )
    assert r.status_code == 404, r.text

    # 5. me — 프로필·링크 반영
    r = await api.get("/api/v1/app/me", headers=app_user["headers"])
    assert r.status_code == 200, r.text
    me = r.json()
    assert any(p["id"] == profile_id for p in me["profiles"]), me
    assert any(
        link["id"] == link_id and link["status"] == "active" for link in me["links"]
    ), me
    assert me["links"][0]["center_name"], me

    # 스탭 상태 = linked
    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/status",
        headers=manager["headers"],
    )
    assert r.status_code == 200, r.text
    status = r.json()
    assert status["status"] == "linked"
    assert any(c["client_id"] == child_id for c in status["linked_children"])

    # 6. 읽기 투영 — 일정·진행 (데이터 없음 = 빈 결과, 200)
    r = await api.get(
        "/api/v1/app/schedules",
        params={"start": "2026-01-01T00:00:00", "end": "2026-12-31T23:59:59"},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)

    r = await api.get(
        f"/api/v1/app/profiles/{profile_id}/progress",
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    progress = r.json()
    assert progress["counseling"] == []
    assert progress["assessments"] == []

    # 7. 앱에는 연결 해제 표면이 없다 — 경로 자체가 미등록이라 404
    r = await api.delete(
        f"/api/v1/app/links/{link_id}",
        headers=app_user["headers"],
    )
    assert r.status_code == 404, r.text


async def test_app_invitation_guardian_only(api, manager):
    """아이(client role)에게는 초대 코드를 발급할 수 없다 (§0-6 원칙 1)."""
    cid = manager["center_id"]
    headers = manager["headers"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={"role": "client", "name": unique("아동만"), "birth_date": "2021-01-01"},
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    child_id = r.json()["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{child_id}/app-link/invitations",
        headers=headers,
    )
    assert r.status_code == 400, r.text


async def test_app_invitation_self_link_promotes_and_issues(api, manager):
    """보호자 없는 청소년·성인 본인 — self_link 발급 시 both 승격 + 코드 발급."""
    cid = manager["center_id"]
    headers = manager["headers"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={"role": "client", "name": unique("본인내담"), "birth_date": "2010-01-01"},
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    client_id = r.json()["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{client_id}/app-link/invitations",
        json={"self_link": True},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    assert len(code) == 6 and code.isdigit()

    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{client_id}", headers=headers
    )
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "both"

    # 승격됐으니 발급 상태 조회도 보호자 경로로 성립
    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{client_id}/app-link/status",
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "invited"

    # 앱에서 코드 검증 → 본인이 연결 후보로 잡힌다
    r = await api.post(
        "/api/v1/app/link-invitations/verify",
        json={"code": code},
        headers=(await _app_signup(api))["headers"],
    )
    assert r.status_code == 200, r.text
    candidates = r.json()["children"]
    assert len(candidates) == 1
    assert candidates[0]["client_id"] == client_id
    assert candidates[0]["is_self"] is True


async def test_app_invitation_self_link_under_14_rejected(api, manager):
    """만 14세 미만은 본인 연결 발급 불가 (법정대리인 동의 필요)."""
    cid = manager["center_id"]
    headers = manager["headers"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={"role": "client", "name": unique("미성년"), "birth_date": "2020-01-01"},
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    client_id = r.json()["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{client_id}/app-link/invitations",
        json={"self_link": True},
        headers=headers,
    )
    assert r.status_code == 400, r.text

    # 거절됐으니 승격도 없어야 한다
    r = await api.get(
        f"/api/v1/centers/{cid}/clients/{client_id}", headers=headers
    )
    assert r.json()["role"] == "client"


async def test_app_invitation_self_link_requires_birth_date(api, manager):
    """생년월일 미등록이면 나이를 판정할 수 없어 본인 연결 발급 불가."""
    cid = manager["center_id"]
    headers = manager["headers"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={"role": "client", "name": unique("생일없음")},
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    client_id = r.json()["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{client_id}/app-link/invitations",
        json={"self_link": True},
        headers=headers,
    )
    assert r.status_code == 400, r.text


async def test_app_profile_crud_and_dedup_suggestion(api, manager):
    """프로필 CRUD + 코드 검증 시 이름+생년월일 일치 프로필 제안."""
    cid = manager["center_id"]
    guardian_id, child_id, child_name = await _create_guardian_with_child(api, manager)
    app_user = await _app_signup(api)

    # 미리 같은 이름+생년월일 프로필 생성 → verify에서 제안돼야 함
    r = await api.post(
        "/api/v1/app/profiles",
        json={
            "display_name": child_name,
            "relation": "child",
            "birth_date": "2020-03-01",
            "gender": "male",
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 201, r.text
    profile_id = r.json()["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/invitations",
        headers=manager["headers"],
    )
    assert r.status_code == 201, r.text
    code = r.json()["code"]

    r = await api.post(
        "/api/v1/app/link-invitations/verify",
        json={"code": code},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    candidate = next(
        c for c in r.json()["children"] if c["client_id"] == child_id
    )
    assert candidate["suggested_profile_id"] == profile_id

    # 기존 프로필로 연결
    r = await api.post(
        "/api/v1/app/links/claim",
        json={
            "code": code,
            "mappings": [{"client_id": child_id, "profile_id": profile_id}],
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text

    # 연결된 프로필은 삭제도 수정도 불가 — 센터 명부의 투영이라 readonly
    r = await api.delete(
        f"/api/v1/app/profiles/{profile_id}",
        headers=app_user["headers"],
    )
    assert r.status_code == 409, r.text

    r = await api.patch(
        f"/api/v1/app/profiles/{profile_id}",
        json={"display_name": "수정된이름"},
        headers=app_user["headers"],
    )
    assert r.status_code == 409, r.text

    r = await api.get("/api/v1/app/profiles", headers=app_user["headers"])
    assert r.status_code == 200, r.text
    assert next(p for p in r.json() if p["id"] == profile_id)["is_linked"] is True


async def test_app_link_match_key_and_center_overwrite(api, manager):
    """제안 키 = 이름+생년월일+성별(한쪽 null은 판정 보류) · 연결 시 센터 값으로 덮어쓰기."""
    cid = manager["center_id"]
    guardian_id, child_id, child_name = await _create_guardian_with_child(api, manager)
    app_user = await _app_signup(api)

    # ① 성별 불일치 → 이름·생년월일이 같아도 탈락
    r = await api.post(
        "/api/v1/app/profiles",
        json={
            "display_name": child_name,
            "relation": "child",
            "birth_date": "2020-03-01",
            "gender": "female",
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 201, r.text
    mismatched_id = r.json()["id"]

    # ② 생년월일·성별 미수집 → 판정 보류로 제안된다(3키 전부 요구하면 여기서 분열난다)
    r = await api.post(
        "/api/v1/app/profiles",
        json={"display_name": child_name, "relation": "child"},
        headers=app_user["headers"],
    )
    assert r.status_code == 201, r.text
    sparse_id = r.json()["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/invitations",
        headers=manager["headers"],
    )
    assert r.status_code == 201, r.text
    code = r.json()["code"]

    r = await api.post(
        "/api/v1/app/link-invitations/verify",
        json={"code": code},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    candidate = next(c for c in r.json()["children"] if c["client_id"] == child_id)
    assert candidate["suggested_profile_id"] == sparse_id, candidate

    r = await api.post(
        "/api/v1/app/links/claim",
        json={"code": code, "mappings": [{"client_id": child_id, "profile_id": sparse_id}]},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text

    # 연결 = 센터 명부 값이 정본 — 비어 있던 생년월일·성별이 채워진다
    r = await api.get("/api/v1/app/profiles", headers=app_user["headers"])
    assert r.status_code == 200, r.text
    linked = next(p for p in r.json() if p["id"] == sparse_id)
    assert linked["birth_date"] == "2020-03-01", linked
    assert linked["gender"] == "male", linked
    assert linked["is_linked"] is True

    # 안 걸린 프로필은 그대로 수정 가능
    r = await api.patch(
        f"/api/v1/app/profiles/{mismatched_id}",
        json={"display_name": "그대로수정됨"},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text


async def test_app_profile_merge_carries_records(api, manager):
    """연결 때 갈라진 프로필 합치기 — 기록 전건이 연동 프로필로 따라가고 원본은 사라진다."""
    cid = manager["center_id"]
    guardian_id, child_id, child_name = await _create_guardian_with_child(api, manager)
    app_user = await _app_signup(api)

    # 연동 전에 직접 만든 프로필에 기록을 쌓는다
    r = await api.post(
        "/api/v1/app/profiles",
        json={"display_name": "은서", "relation": "child"},
        headers=app_user["headers"],
    )
    assert r.status_code == 201, r.text
    orphan_id = r.json()["id"]

    for i in range(2):
        r = await api.post(
            "/api/v1/app/records",
            json={
                "profile_id": orphan_id,
                "client_key": f"merge-{orphan_id}-{i}",
                "occurred_at": f"2026-07-1{i}T09:00:00",
                "mood": "calm",
                "body": f"연동 전 기록 {i}",
            },
            headers=app_user["headers"],
        )
        assert r.status_code == 201, r.text

    # 매칭을 못 받고 새 프로필로 연결된 상황(이름이 달라 제안 대상이 아니다)
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/invitations",
        headers=manager["headers"],
    )
    assert r.status_code == 201, r.text
    code = r.json()["code"]

    r = await api.post(
        "/api/v1/app/link-invitations/verify",
        json={"code": code},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert next(
        c for c in r.json()["children"] if c["client_id"] == child_id
    )["suggested_profile_id"] is None

    r = await api.post(
        "/api/v1/app/links/claim",
        json={
            "code": code,
            "mappings": [
                {
                    "client_id": child_id,
                    "new_profile": {"display_name": child_name, "relation": "child"},
                }
            ],
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    linked_profile_id = r.json()["links"][0]["profile_id"]

    r = await api.post(
        f"/api/v1/app/profiles/{orphan_id}/merge",
        json={"target_profile_id": linked_profile_id},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["id"] == linked_profile_id
    assert r.json()["is_linked"] is True

    # 기록 2건이 연동 프로필로 따라왔고, 원본 프로필은 사라졌다
    r = await api.get("/api/v1/app/records", headers=app_user["headers"])
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 2, items
    assert {i["profile_id"] for i in items} == {linked_profile_id}

    r = await api.get("/api/v1/app/profiles", headers=app_user["headers"])
    assert [p["id"] for p in r.json()] == [linked_profile_id]


async def test_app_profile_merge_moves_link_to_target(api, manager):
    """연결된 쪽을 없애는 방향도 합칠 수 있다 — 링크가 revoke+신규로 target 에 옮겨진다.

    양쪽 다 링크가 있어 어느 방향으로도 못 합치던 게 분열 고착의 원인이었다.
    """
    cid = manager["center_id"]
    guardian_id, child_id, child_name = await _create_guardian_with_child(api, manager)
    app_user = await _app_signup(api)

    r = await api.post(
        "/api/v1/app/profiles",
        json={"display_name": "은서", "relation": "child"},
        headers=app_user["headers"],
    )
    assert r.status_code == 201, r.text
    orphan_id = r.json()["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/invitations",
        headers=manager["headers"],
    )
    code = r.json()["code"]
    r = await api.post(
        "/api/v1/app/links/claim",
        json={
            "code": code,
            "mappings": [
                {
                    "client_id": child_id,
                    "new_profile": {"display_name": child_name, "relation": "child"},
                }
            ],
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    linked_profile_id = r.json()["links"][0]["profile_id"]

    r = await api.get("/api/v1/app/me", headers=app_user["headers"])
    before = next(link for link in r.json()["links"] if link["status"] == "active")

    # 연결된 쪽(source)이 사라지고 링크는 orphan 으로 따라온다
    r = await api.post(
        f"/api/v1/app/profiles/{linked_profile_id}/merge",
        json={"target_profile_id": orphan_id},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["id"] == orphan_id
    assert r.json()["is_linked"] is True

    r = await api.get("/api/v1/app/profiles", headers=app_user["headers"])
    assert [p["id"] for p in r.json()] == [orphan_id]

    r = await api.get("/api/v1/app/me", headers=app_user["headers"])
    links = r.json()["links"]
    # in-place 수정이 아니라 새 행이어야 한다(§14-1) — 옛 행은 mismap 이라 표면에서 빠진다
    assert len(links) == 1, links
    after = links[0]
    assert after["profile_id"] == orphan_id
    assert after["id"] != before["id"]
    assert after["client_id"] == before["client_id"]
    # 연결일은 원래 값을 유지한다(오늘로 리셋되면 "언제부터 다녔나"가 사라진다)
    assert after["linked_at"] == before["linked_at"]


async def test_app_link_rejects_remapping_linked_child(api, manager):
    """이미 연결된 아이를 다른 프로필로 다시 매핑하면 거절 — 유령 프로필·거짓 감사 차단."""
    cid = manager["center_id"]
    guardian_id, child_id, child_name = await _create_guardian_with_child(api, manager)
    app_user = await _app_signup(api)

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/invitations",
        headers=manager["headers"],
    )
    code = r.json()["code"]
    r = await api.post(
        "/api/v1/app/links/claim",
        json={
            "code": code,
            "mappings": [
                {
                    "client_id": child_id,
                    "new_profile": {"display_name": child_name, "relation": "child"},
                }
            ],
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text

    r = await api.get("/api/v1/app/profiles", headers=app_user["headers"])
    profile_ids_before = {p["id"] for p in r.json()}

    # 재발급 코드로 같은 아이를 새 프로필에 매핑 시도
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/invitations",
        headers=manager["headers"],
    )
    assert r.status_code == 201, r.text
    second_code = r.json()["code"]

    r = await api.post(
        "/api/v1/app/links/claim",
        json={
            "code": second_code,
            "mappings": [
                {
                    "client_id": child_id,
                    "new_profile": {"display_name": "다른이름", "relation": "child"},
                }
            ],
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 400, r.text

    # 부작용 0 — 유령 프로필이 남지 않고 초대도 소모되지 않는다
    r = await api.get("/api/v1/app/profiles", headers=app_user["headers"])
    assert {p["id"] for p in r.json()} == profile_ids_before

    r = await api.post(
        "/api/v1/app/link-invitations/verify",
        json={"code": second_code},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text


async def test_public_voucher_catalog(api):
    """게스트(무토큰)가 제도 카탈로그를 읽는다 — eligibility 포함 공개 투영, 직원 표면은 차단 유지."""
    from app.infrastructure.persistence.database import AsyncSessionLocal
    from app.modules.voucher.voucher.models import Voucher

    name = unique("공개바우처")
    async with AsyncSessionLocal() as session:
        session.add(
            Voucher(
                name=name,
                program_name="지역사회서비스투자사업",
                program_organization="테스트도",
                program_year=2026,
                support_amount={
                    "통화": "KRW",
                    "월총액": {"최소": 160000, "최대": 160000},
                },
                support_target="만 12세 이하 아동",
                eligibility={
                    "min_age": None,
                    "max_age": 12,
                    "income_max_pct": 140,
                    "need_evidence": False,
                },
            )
        )
        await session.commit()

    # 무토큰 조회
    r = await api.get("/api/v1/app/vouchers")
    assert r.status_code == 200, r.text
    item = next(i for i in r.json() if i["name"] == name)
    assert item["support_amount_text"] == "월 160,000원"
    assert item["eligibility"]["max_age"] == 12
    assert item["eligibility"]["need_evidence"] is False

    # 직원 카탈로그 표면은 무토큰 접근 불가(공개 전환 아님)
    r = await api.get("/api/v1/centers/any/voucher-catalog")
    assert r.status_code in (401, 403), r.text


async def test_app_client_vouchers_projection(api, manager):
    """연결된 프로필의 보유 바우처 투영 — 제도명·잔여 회기가 따라오고, 남의 가족엔 안 보인다."""
    from app.infrastructure.persistence.database import AsyncSessionLocal
    from app.modules.voucher.voucher.models import Voucher

    cid = manager["center_id"]
    guardian_id, child_id, child_name = await _create_guardian_with_child(api, manager)

    catalog_name = unique("보유바우처")
    async with AsyncSessionLocal() as session:
        catalog = Voucher(
            name=catalog_name,
            program_name="발달재활서비스",
            program_organization="테스트부",
            program_year=2026,
        )
        session.add(catalog)
        await session.commit()
        catalog_id = catalog.id

    r = await api.post(
        f"/api/v1/centers/{cid}/center-vouchers",
        json={"catalog_id": catalog_id, "default_total_sessions": 10},
        headers=manager["headers"],
    )
    assert r.status_code == 201, r.text
    center_voucher_id = r.json()["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/client-vouchers",
        json={
            "client_id": child_id,
            "center_voucher_id": center_voucher_id,
            "total_sessions": 10,
            "remaining_sessions": 4,
            "valid_until": "2026-12-31",
        },
        headers=manager["headers"],
    )
    assert r.status_code == 201, r.text

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/invitations",
        headers=manager["headers"],
    )
    assert r.status_code == 201, r.text
    code = r.json()["code"]

    app_user = await _app_signup(api)
    r = await api.post(
        "/api/v1/app/links/claim",
        json={
            "code": code,
            "mappings": [
                {"client_id": child_id, "new_profile": {"display_name": child_name}}
            ],
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    profile_id = r.json()["links"][0]["profile_id"]

    r = await api.get("/api/v1/app/client-vouchers", headers=app_user["headers"])
    assert r.status_code == 200, r.text
    item = next(i for i in r.json() if i["name"] == catalog_name)
    assert item["profile_id"] == profile_id
    assert item["profile_name"] == child_name
    assert item["program_organization"] == "테스트부"
    assert item["total_sessions"] == 10
    assert item["remaining_sessions"] == 4
    assert item["valid_until"] == "2026-12-31"

    # 미연결 계정은 빈 목록 (G2 — 자기 가족만)
    other = await _app_signup(api)
    r = await api.get("/api/v1/app/client-vouchers", headers=other["headers"])
    assert r.status_code == 200, r.text
    assert r.json() == []

    # 직원 토큰으로는 앱 표면 진입 불가
    r = await api.get("/api/v1/app/client-vouchers", headers=manager["headers"])
    assert r.status_code == 401, r.text


async def test_app_record_crud_and_private_memo_scope(api, manager):
    """기록 작성·조회·수정·북마크·삭제 + 개인 메모는 작성자에게만."""
    app_user = await _app_signup(api)

    r = await api.post(
        "/api/v1/app/profiles",
        json={"display_name": "은서", "relation": "child"},
        headers=app_user["headers"],
    )
    assert r.status_code == 201, r.text
    profile_id = r.json()["id"]

    payload = {
        "profile_id": profile_id,
        "client_key": f"ck-{profile_id}",
        "occurred_at": "2026-07-16T14:00:00",
        "mood": "sad",
        "body": "마트에서 장난감을 사지 못하자 바닥에 앉아 울었어요.",
        "private_memo": "아직 나아지고 있다는 느낌이 들지 않는다.",
    }
    r = await api.post("/api/v1/app/records", json=payload, headers=app_user["headers"])
    assert r.status_code == 201, r.text
    record = r.json()
    record_id = record["id"]
    assert record["mood"] == "sad"
    assert record["is_mine"] is True
    assert record["private_memo"] == payload["private_memo"]

    # 같은 client_key 재전송 = 멱등(새 행 안 생김)
    r = await api.post("/api/v1/app/records", json=payload, headers=app_user["headers"])
    assert r.status_code == 201, r.text
    assert r.json()["id"] == record_id

    r = await api.get("/api/v1/app/records", headers=app_user["headers"])
    assert r.status_code == 200, r.text
    assert [i["id"] for i in r.json()["items"]] == [record_id]

    # 하루 필터 [from, to) — 기록 탭이 고른 날짜만 보여줄 때 쓰는 경로
    r = await api.get(
        "/api/v1/app/records",
        params={"occurred_from": "2026-07-16T00:00:00", "occurred_to": "2026-07-17T00:00:00"},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert [i["id"] for i in r.json()["items"]] == [record_id]

    # 다음 날은 빈 목록 — to가 반개구간이라 경계 기록이 넘어오지 않는다
    r = await api.get(
        "/api/v1/app/records",
        params={"occurred_from": "2026-07-17T00:00:00", "occurred_to": "2026-07-18T00:00:00"},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["items"] == []

    r = await api.get(
        "/api/v1/app/records/dates",
        params={"occurred_from": "2026-07-01T00:00:00", "occurred_to": "2026-08-01T00:00:00"},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["counts"] == {"2026-07-16": 1}

    r = await api.patch(
        f"/api/v1/app/records/{record_id}",
        json={"body": "수정된 본문"},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["body"] == "수정된 본문"

    r = await api.patch(
        f"/api/v1/app/records/{record_id}/bookmark",
        json={"bookmarked": True},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["bookmarked_at"] is not None

    r = await api.get(
        "/api/v1/app/records",
        params={"bookmarked_only": True},
        headers=app_user["headers"],
    )
    assert [i["id"] for i in r.json()["items"]] == [record_id]

    # 남의 가족 기록은 안 보인다 (G2)
    other = await _app_signup(api)
    r = await api.get(f"/api/v1/app/records/{record_id}", headers=other["headers"])
    assert r.status_code == 404, r.text

    # 삭제 = 내용 파기 + tombstone → 목록·상세에서 사라진다
    r = await api.delete(f"/api/v1/app/records/{record_id}", headers=app_user["headers"])
    assert r.status_code == 204, r.text
    r = await api.get(f"/api/v1/app/records/{record_id}", headers=app_user["headers"])
    assert r.status_code == 404, r.text


async def test_app_record_move_between_profiles(api, manager):
    """기록 1건 프로필 이동 — 잘못 고른 아이를 되돌리는 경로(설계.md §15-5)."""
    app_user = await _app_signup(api)

    profile_ids = []
    for name in ("은서", "지호"):
        r = await api.post(
            "/api/v1/app/profiles",
            json={"display_name": name, "relation": "child"},
            headers=app_user["headers"],
        )
        assert r.status_code == 201, r.text
        profile_ids.append(r.json()["id"])
    source_id, target_id = profile_ids

    r = await api.post(
        "/api/v1/app/records",
        json={
            "profile_id": source_id,
            "client_key": f"move-{source_id}",
            "occurred_at": "2026-07-20T10:00:00",
            "mood": "calm",
            "body": "잘못 고른 아이로 저장한 기록",
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 201, r.text
    record_id = r.json()["id"]

    r = await api.patch(
        f"/api/v1/app/records/{record_id}/profile",
        json={"target_profile_id": target_id},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["profile_id"] == target_id
    # 날짜는 쓴 날 그대로 보존
    assert r.json()["occurred_at"].startswith("2026-07-20T10:00:00")


def _put_local_object(upload_url: str, payload: bytes) -> None:
    """로컬 스토리지는 presigned PUT 대상이 없어 file:// 경로에 직접 쓴다."""
    import pathlib

    path = pathlib.Path(upload_url.removeprefix("file://"))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


async def test_app_record_media_upload_and_video_limits(api, manager):
    """첨부 예약→완료→목록 노출, 영상 60초 상한·월 쿼터."""
    app_user = await _app_signup(api)
    r = await api.post(
        "/api/v1/app/profiles",
        json={"display_name": "은서", "relation": "child"},
        headers=app_user["headers"],
    )
    profile_id = r.json()["id"]

    async def _make_record(key: str) -> str:
        r = await api.post(
            "/api/v1/app/records",
            json={
                "profile_id": profile_id,
                "client_key": key,
                "occurred_at": "2026-07-16T14:00:00",
                "mood": "calm",
                "body": "기록",
            },
            headers=app_user["headers"],
        )
        assert r.status_code == 201, r.text
        return r.json()["id"]

    record_id = await _make_record("media-1")

    # 사진 예약 → 완료
    r = await api.post(
        f"/api/v1/app/records/{record_id}/media/upload-url",
        json={"media_type": "image", "content_type": "image/jpeg"},
        headers=app_user["headers"],
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["upload_url"]
    media_id = body["media"]["id"]
    assert body["media"]["upload_status"] == "pending"

    # 업로드 전이라 목록엔 url 없음
    r = await api.get(f"/api/v1/app/records/{record_id}", headers=app_user["headers"])
    assert r.json()["media"][0]["url"] is None

    # 업로드 전 complete는 거부 — 서버가 객체를 직접 확인한다
    r = await api.post(
        f"/api/v1/app/records/{record_id}/media/{media_id}/complete",
        json={},
        headers=app_user["headers"],
    )
    assert r.status_code == 400, r.text

    _put_local_object(body["upload_url"], b"x" * 1024)

    r = await api.post(
        f"/api/v1/app/records/{record_id}/media/{media_id}/complete",
        json={"width": 1024, "height": 768},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["upload_status"] == "ready"

    r = await api.get(f"/api/v1/app/records/{record_id}", headers=app_user["headers"])
    media = r.json()["media"]
    assert len(media) == 1 and media[0]["url"], media

    # 영상 60초 초과는 거부
    r = await api.post(
        f"/api/v1/app/records/{record_id}/media/upload-url",
        json={"media_type": "video", "content_type": "video/mp4", "duration_ms": 150_000},
        headers=app_user["headers"],
    )
    assert r.status_code == 400, r.text

    # 영상 월 10개 쿼터
    for i in range(10):
        r = await api.post(
            f"/api/v1/app/records/{record_id}/media/upload-url",
            json={"media_type": "video", "content_type": "video/mp4", "duration_ms": 30_000},
            headers=app_user["headers"],
        )
        assert r.status_code == 201, (i, r.text)
    r = await api.post(
        f"/api/v1/app/records/{record_id}/media/upload-url",
        json={"media_type": "video", "content_type": "video/mp4", "duration_ms": 30_000},
        headers=app_user["headers"],
    )
    assert r.status_code == 429, r.text

    # 첨부 삭제
    r = await api.delete(
        f"/api/v1/app/records/{record_id}/media/{media_id}",
        headers=app_user["headers"],
    )
    assert r.status_code == 204, r.text
    r = await api.get(f"/api/v1/app/records/{record_id}", headers=app_user["headers"])
    assert all(m["id"] != media_id for m in r.json()["media"])
