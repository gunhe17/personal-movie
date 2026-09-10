"""권한/멤버십 경계: 역할별 접근 제어가 살아 있는지 검증.

기대값 근거: core/permissions 매트릭스 + CLAUDE.md 역할 정의
(관리자 전용 영역 = 멤버·결제·운영 / 상담사는 임상 업무).
"""
import uuid


async def test_manager_can_list_members(api, manager):
    r = await api.get(
        f"/api/v1/centers/{manager['center_id']}/members/",
        headers=manager["headers"],
    )
    assert r.status_code == 200, r.text


async def test_counselor_cannot_invite_members(api, counselor):
    """멤버 초대(write:member)는 관리자 전용."""
    r = await api.post(
        f"/api/v1/centers/{counselor['center_id']}/members/invitations",
        json={
            "name": "침입자",
            "email": "intruder@test.com",
            "role_code": "COUNSELOR",
            "employment_type": "FULLTIME",
        },
        headers=counselor["headers"],
    )
    assert r.status_code == 403, f"상담사 멤버 초대가 차단되지 않음: {r.status_code} {r.text}"


async def test_non_member_center_access_denied(api, manager):
    """소속되지 않은(존재하지 않는) 센터 접근은 거부된다."""
    fake_center = str(uuid.uuid4())
    r = await api.get(
        f"/api/v1/centers/{fake_center}/clients/",
        headers=manager["headers"],
    )
    assert r.status_code in (403, 404), r.text


async def test_staff_without_membership_denied(api, staff, manager):
    """센터 무소속 계정(staff)은 유효한 센터에도 접근 불가."""
    r = await api.get(
        f"/api/v1/centers/{manager['center_id']}/clients/",
        headers=staff["headers"],
    )
    assert r.status_code in (403, 404), r.text


async def test_counselor_can_read_clients(api, counselor):
    """상담사는 임상 업무(내담자 조회)가 가능해야 한다."""
    r = await api.get(
        f"/api/v1/centers/{counselor['center_id']}/clients/",
        params={"page": 1, "size": 10},
        headers=counselor["headers"],
    )
    assert r.status_code == 200, r.text
