"""일정 생성 + 충돌 감지 복합 플로우.

같은 담당자/같은 장소의 시간대 겹침이 has_conflict로 보고되는지,
검증 규칙(end<=start)이 422로 막히는지 검증한다.
"""
from .helpers import first_room_id, member_id_by_name

# 세션마다 스키마가 리셋되므로 고정 미래 시각 사용 (KST 무관, UTC naive)
DAY = "2026-09-01"


async def test_schedule_create_and_conflict_flow(api, manager):
    cid = manager["center_id"]
    headers = manager["headers"]
    room_id = await first_room_id(api, manager)
    counselor_id = await member_id_by_name(api, manager, "정상담")

    # 1. 기준 일정 (10:00~11:00)
    r = await api.post(
        f"/api/v1/centers/{cid}/schedules/",
        json={
            "schedule_type": "meeting",
            "title": "E2E 기준 일정",
            "member_id": counselor_id,
            "room_id": room_id,
            "start": f"{DAY}T10:00:00",
            "end": f"{DAY}T11:00:00",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    base = r.json()
    assert base.get("has_conflict") is False, f"첫 일정이 충돌로 보고됨: {base}"

    # 2. 같은 담당자+장소로 겹치는 일정 (10:30~11:30) → 충돌 감지
    r = await api.post(
        f"/api/v1/centers/{cid}/schedules/",
        json={
            "schedule_type": "meeting",
            "title": "E2E 충돌 일정",
            "member_id": counselor_id,
            "room_id": room_id,
            "start": f"{DAY}T10:30:00",
            "end": f"{DAY}T11:30:00",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    conflicted = r.json()
    assert conflicted.get("has_conflict") is True, f"겹침 미감지: {conflicted}"
    assert conflicted.get("conflicting_schedules"), "충돌 상대 목록이 비어 있음"

    # 3. 겹치지 않는 시간(13:00~14:00) → 충돌 없음
    r = await api.post(
        f"/api/v1/centers/{cid}/schedules/",
        json={
            "schedule_type": "meeting",
            "title": "E2E 비충돌 일정",
            "member_id": counselor_id,
            "room_id": room_id,
            "start": f"{DAY}T13:00:00",
            "end": f"{DAY}T14:00:00",
        },
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    assert r.json().get("has_conflict") is False


async def test_schedule_rejects_end_before_start(api, manager):
    cid = manager["center_id"]
    r = await api.post(
        f"/api/v1/centers/{cid}/schedules/",
        json={
            "schedule_type": "meeting",
            "title": "역순 일정",
            "start": f"{DAY}T15:00:00",
            "end": f"{DAY}T14:00:00",
        },
        headers=manager["headers"],
    )
    assert r.status_code == 422, f"end<=start가 통과됨: {r.status_code}"
