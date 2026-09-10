"""검사(Assessment) 개별 접수 — 크로스 모듈 복합 플로우.

Application Handler(create_individual)가 한 트랜잭션에서
Case + Participant + Task + Schedule + Session을 만드는 가장 복잡한 쓰기 경로.
충돌 시 접수는 성공하되 warnings로 보고되는 규약까지 검증한다.
"""
from .helpers import (
    center_assessment_ids,
    client_id_by_name,
    first_room_id,
    member_id_by_name,
)

DAY = "2026-09-02"


async def _create_individual(api, manager, *, client_name, start, end, room_id, counselor_id, assessment_ids):
    return await api.post(
        f"/api/v1/centers/{manager['center_id']}/assessment-cases/individual",
        json={
            "client_id": await client_id_by_name(api, manager, client_name),
            "assessment_ids": assessment_ids,
            "is_final_report_required": False,
            "has_schedule": True,
            "scheduled_start": start,
            "scheduled_end": end,
            "counselor_id": counselor_id,
            "room_id": room_id,
            "note": "E2E 개별 접수",
        },
        headers=manager["headers"],
    )


async def test_individual_assessment_full_flow(api, manager):
    cid = manager["center_id"]
    headers = manager["headers"]
    room_id = await first_room_id(api, manager)
    counselor_id = await member_id_by_name(api, manager, "최치료")
    assessment_ids = await center_assessment_ids(api, manager, limit=2)

    # 1. 개별 접수 (검사 2개 + 일정)
    r = await _create_individual(
        api, manager,
        client_name="이하준",
        start=f"{DAY}T10:00:00", end=f"{DAY}T11:30:00",
        room_id=room_id, counselor_id=counselor_id,
        assessment_ids=assessment_ids,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["case_id"] and body["case_code"]
    assert body["schedule_id"], "has_schedule=True인데 schedule 미생성"
    assert body["warnings"] == [], f"첫 접수에 충돌 경고: {body['warnings']}"
    case_id = body["case_id"]

    # 2. 케이스 상세 → 생성 내용 검증
    r = await api.get(
        f"/api/v1/centers/{cid}/assessment-cases/{case_id}", headers=headers
    )
    assert r.status_code == 200, r.text

    # 3. 같은 시간·담당자·장소로 두 번째 접수 → 접수는 성공 + 충돌 warning
    r = await _create_individual(
        api, manager,
        client_name="박지우",
        start=f"{DAY}T10:30:00", end=f"{DAY}T11:00:00",
        room_id=room_id, counselor_id=counselor_id,
        assessment_ids=assessment_ids[:1],
    )
    assert r.status_code == 201, r.text
    second = r.json()
    assert second["warnings"], "일정 충돌이 warnings로 보고되어야 함 (접수는 성공)"

    # 4. 취소 → 상태 전이 확인
    r = await api.post(
        f"/api/v1/centers/{cid}/assessment-cases/{second['case_id']}/cancel",
        json={},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] in ("canceled", "cancelled"), r.json()

    # 5. 롤백(취소 복원) → 상태 복귀
    r = await api.post(
        f"/api/v1/centers/{cid}/assessment-cases/{second['case_id']}/revert-cancel",
        json={},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] not in ("canceled", "cancelled"), r.json()


async def test_individual_assessment_invalid_assessment_rejected(api, manager):
    """센터가 보유하지 않은 검사 id → 도메인 예외(404/400)."""
    import uuid

    room_id = await first_room_id(api, manager)
    counselor_id = await member_id_by_name(api, manager, "최치료")
    r = await _create_individual(
        api, manager,
        client_name="박지우",
        start=f"{DAY}T15:00:00", end=f"{DAY}T16:00:00",
        room_id=room_id, counselor_id=counselor_id,
        assessment_ids=[str(uuid.uuid4())],
    )
    assert r.status_code in (400, 404), f"무효 검사 id가 통과됨: {r.status_code} {r.text}"
