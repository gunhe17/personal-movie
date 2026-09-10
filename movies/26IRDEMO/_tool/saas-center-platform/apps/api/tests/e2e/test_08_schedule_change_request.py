"""일정 변경 요청 — 내담자 앱 요청 → 센터 승인/반려.

앱이 가능 시간을 조회하고 그 중 하나로 변경을 요청하면, 센터(스탭)가 승인해
실제 일정 시각이 바뀌는지까지 본다. 재요청 차단·권한 교차도 함께 핀한다.
"""
import random
from datetime import datetime, timedelta, timezone

from .conftest import unique
from .helpers import client_id_by_name, first_program_id, first_room_id, member_id_by_name

KST = timezone(timedelta(hours=9))


def _next_weekday_kst(weekday: int = 2) -> datetime:
    # 근무시간이 설정된 평일을 잡는다(기본 시드 = 월~금)
    now = datetime.now(KST) + timedelta(days=14)
    while now.weekday() != weekday:
        now += timedelta(days=1)
    return now.replace(hour=14, minute=0, second=0, microsecond=0)


_WEEKDAYS = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


async def _ensure_hours(api, manager, member_id: str) -> None:
    # 시드에는 운영시간·근무시간이 없다 — 가능 시간의 두 재료를 직접 깔아준다
    cid, headers = manager["center_id"], manager["headers"]

    r = await api.put(
        f"/api/v1/centers/{cid}/operating-times/",
        json={
            "items": [
                {
                    "weekday": day,
                    "open_time": "09:00:00" if day not in ("SAT", "SUN") else None,
                    "close_time": "18:00:00" if day not in ("SAT", "SUN") else None,
                }
                for day in _WEEKDAYS
            ]
        },
        params={"confirm": True},
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text

    r = await api.put(
        f"/api/v1/centers/{cid}/members/{member_id}/working-times/",
        json={
            "items": [
                {
                    "weekday": day,
                    "start_time": "09:00:00" if day not in ("SAT", "SUN") else None,
                    "end_time": "18:00:00" if day not in ("SAT", "SUN") else None,
                }
                for day in _WEEKDAYS
            ]
        },
        params={"confirm": True},
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text


async def _link_guardian_to_child(api, manager, child_id: str) -> dict:
    cid = manager["center_id"]
    guardian_name = unique("변경보호자")

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={
            "role": "guardian",
            "name": guardian_name,
            "birth_date": "1990-05-05",
            "gender": "female",
            "phone": f"010-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
        },
        headers=manager["headers"],
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
        headers=manager["headers"],
    )
    assert r.status_code == 201, r.text

    r = await api.post(
        f"/api/v1/centers/{cid}/clients/{guardian_id}/app-link/invitations",
        json={},
        headers=manager["headers"],
    )
    assert r.status_code in (200, 201), r.text
    code = r.json()["code"]

    email = f"{unique('changeapp')}@test.com"
    phone = f"010-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
    r = await api.post(
        "/api/v1/app/auth/signup",
        json={
            "email": email,
            "password": "AppPass123!",
            "name": guardian_name,
            "phone": phone,
        },
    )
    assert r.status_code in (200, 201), r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = await api.post(
        "/api/v1/app/link-invitations/verify", json={"code": code}, headers=headers
    )
    assert r.status_code == 200, r.text
    children = r.json()["children"]

    r = await api.post(
        "/api/v1/app/links/claim",
        json={
            "code": code,
            "mappings": [
                {"client_id": c["client_id"], "new_profile": {"display_name": c["name"]}}
                for c in children
            ],
        },
        headers=headers,
    )
    assert r.status_code in (200, 201), r.text
    return {"headers": headers}


async def test_schedule_change_request_flow(api, manager):
    cid = manager["center_id"]
    headers = manager["headers"]

    program_id = await first_program_id(api, manager)
    room_id = await first_room_id(api, manager)
    counselor_id = await member_id_by_name(api, manager, "정상담")
    child_id = await client_id_by_name(api, manager, "박지우")

    await _ensure_hours(api, manager, counselor_id)

    session_day = _next_weekday_kst()
    r = await api.post(
        f"/api/v1/centers/{cid}/counseling/intake",
        json={
            "case": {
                "program_id": program_id,
                "client_ids": [child_id],
                "counselor_ids": [counselor_id],
                "chief_complaint": "변경 요청 E2E",
            },
            "sessions": {
                "dates": [session_day.astimezone(timezone.utc).isoformat()],
                "start_time": "14:00",
                "end_time": "14:50",
                "room_id": room_id,
                "duration_minutes": 50,
            },
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text

    app_user = await _link_guardian_to_child(api, manager, child_id)

    # 앱 일정 목록 — 방금 만든 회기가 보인다
    r = await api.get(
        "/api/v1/app/schedules",
        params={
            "start": (session_day - timedelta(days=1)).astimezone(timezone.utc).replace(tzinfo=None).isoformat(),
            "end": (session_day + timedelta(days=1)).astimezone(timezone.utc).replace(tzinfo=None).isoformat(),
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert items, "연결된 아이의 일정이 앱에 보여야 한다"
    schedule = items[0]
    schedule_id = schedule["schedule_id"]
    assert schedule["pending_change_request"] is None

    # 가능 시간 — 같은 날 그리드가 내려오고, 현재 회기 시간대는 자기 자신을 제외해 열려 있다
    target_date = session_day.date().isoformat()
    r = await api.get(
        f"/api/v1/app/schedules/{schedule_id}/available-slots",
        params={"date": target_date},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    slots = r.json()
    assert slots["date"] == target_date
    assert slots["duration_minutes"] == 50
    open_slots = [s["time"] for s in slots["slots"] if s["available"]]
    assert open_slots, f"가능 시간이 하나는 있어야 한다: {slots}"

    picked = next((s for s in open_slots if s != "14:00"), open_slots[0])
    hour, minute = (int(v) for v in picked.split(":"))
    requested_start = session_day.replace(hour=hour, minute=minute)

    # 변경 요청
    r = await api.post(
        f"/api/v1/app/schedules/{schedule_id}/change-requests",
        json={"start_time": requested_start.astimezone(timezone.utc).isoformat(), "reason": "병원 진료"},
        headers=app_user["headers"],
    )
    assert r.status_code == 201, r.text
    request_id = r.json()["request_id"]
    assert r.json()["status"] == "pending"

    # 같은 일정에 중복 요청 차단
    r = await api.post(
        f"/api/v1/app/schedules/{schedule_id}/change-requests",
        json={"start_time": requested_start.astimezone(timezone.utc).isoformat()},
        headers=app_user["headers"],
    )
    assert r.status_code in (400, 409), r.text

    # 앱 목록에 검토 중 표시
    r = await api.get(
        "/api/v1/app/schedules",
        params={
            "start": (session_day - timedelta(days=1)).astimezone(timezone.utc).replace(tzinfo=None).isoformat(),
            "end": (session_day + timedelta(days=1)).astimezone(timezone.utc).replace(tzinfo=None).isoformat(),
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    pending_item = next(i for i in r.json() if i["schedule_id"] == schedule_id)
    assert pending_item["pending_change_request"]["request_id"] == request_id

    # 스탭 목록 — 대기 건으로 보인다
    r = await api.get(
        f"/api/v1/centers/{cid}/schedule-change-requests",
        params={"status": "pending"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    listed = next(item for item in r.json() if item["id"] == request_id)
    assert listed["client_name"], listed
    assert listed["status"] == "pending"

    # 승인 → 일정 시각이 실제로 바뀐다
    r = await api.post(
        f"/api/v1/centers/{cid}/schedule-change-requests/{request_id}/approve",
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"

    r = await api.get(f"/api/v1/centers/{cid}/schedules/{schedule_id}", headers=headers)
    assert r.status_code == 200, r.text
    raw = r.json()["start"].replace("Z", "")
    moved = datetime.fromisoformat(raw).replace(tzinfo=timezone.utc)
    assert moved.astimezone(KST).strftime("%H:%M") == picked

    # 처리된 요청은 다시 승인되지 않는다
    r = await api.post(
        f"/api/v1/centers/{cid}/schedule-change-requests/{request_id}/approve",
        headers=headers,
    )
    assert r.status_code in (400, 409), r.text


async def test_schedule_change_request_rejects_unowned_schedule(api, manager):
    cid = manager["center_id"]
    child_id = await client_id_by_name(api, manager, "박지우")
    app_user = await _link_guardian_to_child(api, manager, child_id)

    r = await api.post(
        "/api/v1/app/schedules/00000000-0000-0000-0000-000000000000/change-requests",
        json={"start_time": datetime.now(timezone.utc).isoformat()},
        headers=app_user["headers"],
    )
    assert r.status_code in (400, 403, 404), r.text
    assert cid


async def test_available_slots_fall_back_to_center_hours(api, manager):
    """근무시간을 한 번도 설정하지 않은 상담사도 센터 운영시간만큼은 열려야 한다."""
    cid = manager["center_id"]
    headers = manager["headers"]

    program_id = await first_program_id(api, manager)
    room_id = await first_room_id(api, manager)
    # 최치료는 _ensure_hours 대상이 아니라 근무시간 행이 없다
    counselor_id = await member_id_by_name(api, manager, "최치료")
    child_id = await client_id_by_name(api, manager, "박지우")

    session_day = _next_weekday_kst(weekday=3)
    r = await api.post(
        f"/api/v1/centers/{cid}/counseling/intake",
        json={
            "case": {
                "program_id": program_id,
                "client_ids": [child_id],
                "counselor_ids": [counselor_id],
                "chief_complaint": "근무시간 미설정 E2E",
            },
            "sessions": {
                "dates": [session_day.astimezone(timezone.utc).isoformat()],
                "start_time": "15:00",
                "end_time": "15:50",
                "room_id": room_id,
                "duration_minutes": 50,
            },
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text

    app_user = await _link_guardian_to_child(api, manager, child_id)

    r = await api.get(
        "/api/v1/app/schedules",
        params={
            "start": (session_day - timedelta(days=1)).astimezone(timezone.utc).replace(tzinfo=None).isoformat(),
            "end": (session_day + timedelta(days=1)).astimezone(timezone.utc).replace(tzinfo=None).isoformat(),
        },
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    schedule_id = r.json()[0]["schedule_id"]

    r = await api.get(
        f"/api/v1/app/schedules/{schedule_id}/available-slots",
        params={"date": session_day.date().isoformat()},
        headers=app_user["headers"],
    )
    assert r.status_code == 200, r.text
    slots = r.json()
    assert any(s["available"] for s in slots["slots"]), slots
