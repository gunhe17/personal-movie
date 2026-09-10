"""seed 베이스라인 리소스 조회 헬퍼 (E2E 전용).

모든 함수는 인증된 세션(manager 권장)으로 seed가 만든 리소스의 id를 찾는다.
seed 이름은 scripts/seed/develop/ 기준.
"""
from httpx import AsyncClient


async def get_json(api: AsyncClient, session: dict, path: str, **params) -> dict | list:
    r = await api.get(
        f"/api/v1/centers/{session['center_id']}{path}",
        params=params or None,
        headers=session["headers"],
    )
    assert r.status_code == 200, f"GET {path} 실패: {r.status_code} {r.text}"
    return r.json()


async def client_id_by_name(api: AsyncClient, session: dict, name: str) -> str:
    body = await get_json(api, session, "/clients/", page=1, size=100)
    for item in body["items"]:
        if item["name"] == name:
            return item["id"]
    raise AssertionError(f"seed 내담자 없음: {name}")


async def member_id_by_name(api: AsyncClient, session: dict, name: str) -> str:
    body = await get_json(api, session, "/members/", page=1, size=100)
    items = body["items"] if isinstance(body, dict) else body
    for item in items:
        if item.get("name") == name or (item.get("person") or {}).get("name") == name:
            return item["id"]
    raise AssertionError(f"seed 멤버 없음: {name} (응답: {items[:2]})")


async def first_room_id(api: AsyncClient, session: dict) -> str:
    body = await get_json(api, session, "/rooms/")
    items = body["items"] if isinstance(body, dict) else body
    assert items, "seed room 없음"
    return items[0]["id"]


async def first_program_id(api: AsyncClient, session: dict) -> str:
    body = await get_json(api, session, "/programs/")
    items = body["items"] if isinstance(body, dict) else body
    assert items, "seed program 없음"
    return items[0]["id"]


async def center_assessment_ids(api: AsyncClient, session: dict, limit: int = 2) -> list[str]:
    """센터가 사용 가능한 (글로벌) Assessment id 목록."""
    body = await get_json(api, session, "/center-assessments")
    items = body["items"] if isinstance(body, dict) else body
    assert items, "seed center-assessment 없음"
    ids = []
    for item in items[:limit]:
        ids.append(
            item.get("assessment_id")
            or (item.get("assessment") or {}).get("id")
            or item["id"]
        )
    return ids
