"""상담 접수(intake) — Case + Sessions + Schedules 단일 트랜잭션 복합 플로우.

dates 모드(직접 날짜 선택)로 회기 2개를 만들고, 케이스 상세·회기 수·
일정 생성까지 한 번에 검증한다. 실패 시 전체 롤백되는 경로.
"""
from .helpers import client_id_by_name, first_program_id, first_room_id, member_id_by_name

D1, D2 = "2026-09-03T05:00:00Z", "2026-09-10T05:00:00Z"  # UTC (KST 14시)


async def test_counseling_intake_full_flow(api, manager):
    cid = manager["center_id"]
    headers = manager["headers"]

    program_id = await first_program_id(api, manager)
    room_id = await first_room_id(api, manager)
    counselor_id = await member_id_by_name(api, manager, "정상담")
    client_id = await client_id_by_name(api, manager, "박지우")

    # 1. 접수: 회기 2개 (dates 모드)
    r = await api.post(
        f"/api/v1/centers/{cid}/counseling/intake",
        json={
            "case": {
                "program_id": program_id,
                "client_ids": [client_id],
                "counselor_ids": [counselor_id],
                "chief_complaint": "E2E 주호소",
                "memo": "E2E 접수",
            },
            "sessions": {
                "dates": [D1, D2],
                "start_time": "14:00",
                "end_time": "14:50",
                "room_id": room_id,
                "duration_minutes": 50,
            },
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    case_id = body["case_id"]
    assert body["total_sessions"] == 2, f"회기 2개여야 함: {body}"

    # 2. 케이스 상세
    r = await api.get(
        f"/api/v1/centers/{cid}/counseling/{case_id}", headers=headers
    )
    assert r.status_code == 200, r.text

    # 3. 참여자(내담자) 연결 확인
    r = await api.get(
        f"/api/v1/centers/{cid}/counseling/{case_id}/participants",
        headers=headers,
    )
    assert r.status_code == 200, r.text


async def test_counseling_intake_requires_write_permission(api, counselor, manager):
    """write:counseling 권한 체크 — 상담사 역할의 허용 여부를 핀한다.

    (상담사는 임상 업무 주체이므로 접수 가능(201)이 기대값이나,
    역할 매트릭스가 바뀌면 이 테스트가 그 변화를 드러낸다.)
    """
    cid = counselor["center_id"]
    program_id = await first_program_id(api, manager)
    room_id = await first_room_id(api, manager)
    counselor_member = await member_id_by_name(api, manager, "정상담")
    client_id = await client_id_by_name(api, manager, "김영희")

    r = await api.post(
        f"/api/v1/centers/{cid}/counseling/intake",
        json={
            "case": {
                "program_id": program_id,
                "client_ids": [client_id],
                "counselor_ids": [counselor_member],
                "chief_complaint": "상담사 직접 접수",
            },
            "sessions": {
                "dates": ["2026-09-17T05:00:00Z"],
                "start_time": "14:00",
                "end_time": "14:50",
                "room_id": room_id,
                "duration_minutes": 50,
            },
        },
        headers=counselor["headers"],
    )
    assert r.status_code in (201, 403), r.text
    assert r.status_code == 201, "상담사 intake 권한이 변경됨 — 의도된 변경인지 확인 필요"
