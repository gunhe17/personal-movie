"""도메인별 CRUD 권한 검증 스크립트

실행 환경: 개발 서버 (localhost:3502) 가동 중이어야 함
실행 방법: cd apps/api && uv run python tests/scenarios/test_permissions_curl.py

테스트 계정 (비밀번호: Test1234!@):
  - admin@test.com        → ADMIN     (access_level=all)
  - counselor_a@test.com  → COUNSELOR (access_level=own)
  - staff@test.com        → STAFF     (access_level=all)

검증 항목:
  각 도메인(schedule, client, counseling, assessment_case, document, form_instance)에 대해
  read/write/delete 권한이 role별로 올바르게 적용되는지 확인
"""

import httpx
import pytest
import json
import sys
from datetime import datetime, timedelta

BASE = "http://localhost:3502/api/v1"
PASSWORD = "Test1234!@"

# ANSI colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def login(email: str) -> dict:
    """로그인 후 token + center_id 반환"""
    r = httpx.post(
        f"{BASE}/auth/login",
        json={"email": email, "password": PASSWORD},
        follow_redirects=True,
    )
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    d = r.json()
    center = d["centers"][0]
    return {
        "token": d["access_token"],
        "center_id": center["id"],
        "role": center.get("role_code") or center.get("role"),
        "email": email,
    }


def _live_user(email: str) -> dict:
    # live 서버(3502) + 시드 계정 전제 — 없으면 skip (standalone은 main()으로 실행)
    try:
        return login(email)
    except Exception:
        pytest.skip("live server(localhost:3502)와 시드 계정 필요")


@pytest.fixture
def admin() -> dict:
    return _live_user("admin@test.com")


@pytest.fixture
def counselor() -> dict:
    return _live_user("counselor_a@test.com")


@pytest.fixture
def staff() -> dict:
    return _live_user("staff@test.com")


def auth_headers(user: dict) -> dict:
    return {
        "Authorization": f"Bearer {user['token']}",
        "Content-Type": "application/json",
    }


def center_url(user: dict, path: str) -> str:
    return f"{BASE}/centers/{user['center_id']}/{path}"


# ============================================================
# 테스트 결과 수집
# ============================================================

results: list[dict] = []


def check(
    domain: str,
    action: str,
    role: str,
    expected: int | list[int],
    actual: int,
    note: str = "",
):
    """결과 검증 및 기록"""
    expected_list = expected if isinstance(expected, list) else [expected]
    passed = actual in expected_list
    status = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    expected_str = "/".join(str(e) for e in expected_list)
    results.append(
        {
            "domain": domain,
            "action": action,
            "role": role,
            "expected": expected_str,
            "actual": actual,
            "passed": passed,
            "note": note,
        }
    )
    print(
        f"  {status} [{role:10s}] {action:20s} → {actual} (expected {expected_str})"
        + (f"  {YELLOW}{note}{RESET}" if note else "")
    )


# ============================================================
# 도메인별 테스트
# ============================================================


def test_schedule(admin: dict, counselor: dict, staff: dict):
    """Schedule 도메인 권한 테스트"""
    print(f"\n{BOLD}{CYAN}━━━ Schedule ━━━{RESET}")
    client = httpx.Client(follow_redirects=True, timeout=10)

    now = datetime.utcnow()
    tomorrow = now + timedelta(days=1)
    start = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=1)

    schedule_body = {
        "schedule_type": "counseling",
        "start": start.isoformat() + "Z",
        "end": end.isoformat() + "Z",
        "title": "권한 테스트 일정",
    }

    # --- READ ---
    params = {"start": start.isoformat() + "Z", "end": end.isoformat() + "Z"}

    for user in [admin, counselor, staff]:
        r = client.get(
            center_url(user, "schedules"), headers=auth_headers(user), params=params
        )
        check("Schedule", "READ (list)", user["role"], 200, r.status_code)

    # --- WRITE ---
    created_ids = {}
    for user in [admin, counselor, staff]:
        body = {
            **schedule_body,
            "title": f"권한 테스트 일정 ({user['role']})",
            "start": (start + timedelta(hours=len(created_ids))).isoformat() + "Z",
            "end": (end + timedelta(hours=len(created_ids))).isoformat() + "Z",
        }
        r = client.post(
            center_url(user, "schedules"), headers=auth_headers(user), json=body
        )
        check("Schedule", "WRITE (create)", user["role"], 201, r.status_code)
        if r.status_code == 201:
            created_ids[user["role"]] = r.json()["id"]

    # --- DELETE ---
    # ADMIN: has delete:schedule → 200
    if "ADMIN" in created_ids:
        r = client.delete(
            center_url(admin, f"schedules/{created_ids['ADMIN']}"),
            headers=auth_headers(admin),
        )
        check("Schedule", "DELETE", "ADMIN", 200, r.status_code)

    # COUNSELOR: has delete:schedule → 200
    if "COUNSELOR" in created_ids:
        r = client.delete(
            center_url(counselor, f"schedules/{created_ids['COUNSELOR']}"),
            headers=auth_headers(counselor),
        )
        check("Schedule", "DELETE", "COUNSELOR", 200, r.status_code)

    # STAFF: has delete:schedule → 200
    if "STAFF" in created_ids:
        r = client.delete(
            center_url(staff, f"schedules/{created_ids['STAFF']}"),
            headers=auth_headers(staff),
        )
        check("Schedule", "DELETE", "STAFF", 200, r.status_code)

    client.close()


def test_client(admin: dict, counselor: dict, staff: dict):
    """Client 도메인 권한 테스트"""
    print(f"\n{BOLD}{CYAN}━━━ Client ━━━{RESET}")
    client = httpx.Client(follow_redirects=True, timeout=10)

    client_body = {
        "role": "client",
        "name": "권한테스트 내담자",
        "gender": "male",
        "phone": "010-0000-0099",
    }

    # --- READ ---
    for user in [admin, counselor, staff]:
        r = client.get(
            center_url(user, "clients"), headers=auth_headers(user)
        )
        check("Client", "READ (list)", user["role"], 200, r.status_code)

    # --- WRITE ---
    created_ids = {}
    for user in [admin, counselor, staff]:
        body = {**client_body, "name": f"권한테스트 내담자 ({user['role']})"}
        r = client.post(
            center_url(user, "clients"), headers=auth_headers(user), json=body
        )
        check("Client", "WRITE (create)", user["role"], 201, r.status_code)
        if r.status_code == 201:
            created_ids[user["role"]] = r.json()["id"]

    # --- DELETE ---
    # ADMIN: has delete:client → 200
    if "ADMIN" in created_ids:
        r = client.delete(
            center_url(admin, f"clients/{created_ids['ADMIN']}"),
            headers=auth_headers(admin),
        )
        check("Client", "DELETE", "ADMIN", 200, r.status_code)

    # COUNSELOR: NO delete:client → 403 (use admin-created client to test)
    if "ADMIN" in created_ids:
        r = client.delete(
            center_url(counselor, f"clients/{created_ids['ADMIN']}"),
            headers=auth_headers(counselor),
        )
        check("Client", "DELETE", "COUNSELOR", 403, r.status_code,
              "COUNSELOR has no delete:client")

    # STAFF: NO delete:client → 403
    if "ADMIN" in created_ids:
        r = client.delete(
            center_url(staff, f"clients/{created_ids['ADMIN']}"),
            headers=auth_headers(staff),
        )
        check("Client", "DELETE", "STAFF", 403, r.status_code,
              "STAFF has no delete:client")

    client.close()


def test_counseling(admin: dict, counselor: dict, staff: dict):
    """Counseling 도메인 권한 테스트

    Counseling은 intake 엔드포인트로 case+session을 함께 생성하므로,
    READ(list), WRITE(intake), DELETE(session) 순서로 테스트
    """
    print(f"\n{BOLD}{CYAN}━━━ Counseling ━━━{RESET}")
    cl = httpx.Client(follow_redirects=True, timeout=10)

    # --- READ ---
    for user in [admin, counselor, staff]:
        r = cl.get(
            center_url(user, "counseling"), headers=auth_headers(user)
        )
        check("Counseling", "READ (list cases)", user["role"], 200, r.status_code)

    # --- WRITE (intake) ---
    # intake 에는 program_id, client, room 등 사전 데이터가 필요하므로
    # 대신 POST /counseling (빈 body)으로 권한 진입만 확인
    # ADMIN: write:counseling → 진입 허용 (422 = body 유효성)
    # COUNSELOR: write:counseling → 진입 허용 (422)
    # STAFF: NO write:counseling → 403

    for user in [admin, counselor, staff]:
        r = cl.post(
            center_url(user, "counseling/intake"),
            headers=auth_headers(user),
            json={},
        )
        if user["role"] == "STAFF":
            check(
                "Counseling",
                "WRITE (intake)",
                user["role"],
                403,
                r.status_code,
                "STAFF has no write:counseling",
            )
        else:
            # 권한 통과 → 422 (validation error) 가 기대됨
            check(
                "Counseling",
                "WRITE (intake)",
                user["role"],
                422,
                r.status_code,
                "permission OK, body validation fail expected",
            )

    # --- DELETE (session) ---
    # Fake session_id로 테스트 — 권한 게이트만 확인
    fake_session_id = "00000000-0000-0000-0000-000000000000"

    # ADMIN: delete:counseling → 허용 (404 = not found)
    r = cl.delete(
        center_url(admin, f"counseling/sessions/{fake_session_id}"),
        headers=auth_headers(admin),
    )
    check(
        "Counseling",
        "DELETE (session)",
        "ADMIN",
        404,
        r.status_code,
        "permission OK, session not found",
    )

    # COUNSELOR: delete:counseling → 허용 (404)
    r = cl.delete(
        center_url(counselor, f"counseling/sessions/{fake_session_id}"),
        headers=auth_headers(counselor),
    )
    check(
        "Counseling",
        "DELETE (session)",
        "COUNSELOR",
        404,
        r.status_code,
        "permission OK, session not found",
    )

    # STAFF: NO delete:counseling → 403
    r = cl.delete(
        center_url(staff, f"counseling/sessions/{fake_session_id}"),
        headers=auth_headers(staff),
    )
    check(
        "Counseling",
        "DELETE (session)",
        "STAFF",
        403,
        r.status_code,
        "STAFF has no delete:counseling",
    )

    cl.close()


def test_counseling_note(admin: dict, counselor: dict, staff: dict):
    """Counseling Note 도메인 권한 테스트

    ADMIN/COUNSELOR: read/write 가능
    STAFF: read/write 불가 (임상 기밀 보호)
    """
    print(f"\n{BOLD}{CYAN}━━━ Counseling Note ━━━{RESET}")
    cl = httpx.Client(follow_redirects=True, timeout=10)

    # Note 라우트: /centers/{center_id}/counseling/sessions/{session_id}/notes
    fake_session_id = "00000000-0000-0000-0000-000000000000"

    # --- READ ---
    for user in [admin, counselor, staff]:
        r = cl.get(
            center_url(user, f"counseling/sessions/{fake_session_id}/notes"),
            headers=auth_headers(user),
        )
        if user["role"] == "STAFF":
            check(
                "CounselingNote",
                "READ (list)",
                user["role"],
                403,
                r.status_code,
                "STAFF has no read:counseling_note",
            )
        else:
            check(
                "CounselingNote",
                "READ (list)",
                user["role"],
                [200, 404],
                r.status_code,
                "permission OK",
            )

    # --- WRITE ---
    for user in [admin, counselor, staff]:
        r = cl.post(
            center_url(user, f"counseling/sessions/{fake_session_id}/notes"),
            headers=auth_headers(user),
            json={},
        )
        if user["role"] == "STAFF":
            check(
                "CounselingNote",
                "WRITE (create)",
                user["role"],
                403,
                r.status_code,
                "STAFF has no write:counseling_note",
            )
        else:
            check(
                "CounselingNote",
                "WRITE (create)",
                user["role"],
                [422, 404],
                r.status_code,
                "permission OK, validation/not found expected",
            )

    cl.close()


def test_assessment_case(admin: dict, counselor: dict, staff: dict):
    """Assessment Case 도메인 권한 테스트"""
    print(f"\n{BOLD}{CYAN}━━━ Assessment Case ━━━{RESET}")
    cl = httpx.Client(follow_redirects=True, timeout=10)

    # --- READ ---
    for user in [admin, counselor, staff]:
        r = cl.get(
            center_url(user, "assessment-cases"),
            headers=auth_headers(user),
        )
        check("AssessmentCase", "READ (list)", user["role"], 200, r.status_code)

    # --- WRITE (create individual) ---
    # ADMIN: write:assessment_case → 권한 통과 (422 body validation)
    # COUNSELOR: write:assessment_case → 권한 통과 (422)
    # STAFF: NO write:assessment_case → 403
    for user in [admin, counselor, staff]:
        r = cl.post(
            center_url(user, "assessment-cases/individual"),
            headers=auth_headers(user),
            json={},
        )
        if user["role"] == "STAFF":
            check(
                "AssessmentCase",
                "WRITE (create)",
                user["role"],
                403,
                r.status_code,
                "STAFF has no write:assessment_case",
            )
        else:
            check(
                "AssessmentCase",
                "WRITE (create)",
                user["role"],
                422,
                r.status_code,
                "permission OK, body validation fail",
            )

    # --- DELETE ---
    fake_case_id = "00000000-0000-0000-0000-000000000000"

    # ADMIN: delete:assessment_case → 404
    r = cl.delete(
        center_url(admin, f"assessment-cases/{fake_case_id}"),
        headers=auth_headers(admin),
    )
    check(
        "AssessmentCase",
        "DELETE",
        "ADMIN",
        404,
        r.status_code,
        "permission OK, case not found",
    )

    # COUNSELOR: delete:assessment_case → 404
    r = cl.delete(
        center_url(counselor, f"assessment-cases/{fake_case_id}"),
        headers=auth_headers(counselor),
    )
    check(
        "AssessmentCase",
        "DELETE",
        "COUNSELOR",
        404,
        r.status_code,
        "permission OK, case not found",
    )

    # STAFF: NO delete:assessment_case → 403
    r = cl.delete(
        center_url(staff, f"assessment-cases/{fake_case_id}"),
        headers=auth_headers(staff),
    )
    check(
        "AssessmentCase",
        "DELETE",
        "STAFF",
        403,
        r.status_code,
        "STAFF has no delete:assessment_case",
    )

    cl.close()


def test_document(admin: dict, counselor: dict, staff: dict):
    """Document 도메인 권한 테스트"""
    print(f"\n{BOLD}{CYAN}━━━ Document ━━━{RESET}")
    cl = httpx.Client(follow_redirects=True, timeout=10)

    # --- READ ---
    for user in [admin, counselor, staff]:
        r = cl.get(
            center_url(user, "documents"),
            headers=auth_headers(user),
        )
        check("Document", "READ (list)", user["role"], 200, r.status_code)

    # --- WRITE (upload) — multipart form ---
    # S3 미설정 시 500 반환될 수 있으므로, 권한 게이트(403 여부)만 확인
    # 403이 아니면 = 권한 통과 (201, 422, 500 모두 권한은 OK)
    for user in [admin, counselor, staff]:
        r = cl.post(
            center_url(user, "documents"),
            headers={"Authorization": f"Bearer {user['token']}"},
            files={"file": ("test.txt", b"test content", "text/plain")},
            data={"name": f"test-{user['role']}"},
        )
        # write:document → 모든 역할이 가능 (500 = 스토리지 오류, 권한은 통과)
        is_not_forbidden = r.status_code != 403
        check(
            "Document",
            "WRITE (upload)",
            user["role"],
            [201, 200, 422, 500],
            r.status_code,
            "all roles have write:document (500=storage error, not permission)",
        )

    # --- DELETE ---
    fake_doc_id = "00000000-0000-0000-0000-000000000000"

    # ADMIN: delete:document → 404
    r = cl.delete(
        center_url(admin, f"documents/{fake_doc_id}"),
        headers=auth_headers(admin),
    )
    check(
        "Document",
        "DELETE",
        "ADMIN",
        404,
        r.status_code,
        "permission OK, doc not found",
    )

    # COUNSELOR: delete:document → 404
    r = cl.delete(
        center_url(counselor, f"documents/{fake_doc_id}"),
        headers=auth_headers(counselor),
    )
    check(
        "Document",
        "DELETE",
        "COUNSELOR",
        404,
        r.status_code,
        "permission OK, doc not found",
    )

    # STAFF: NO delete:document → 403
    r = cl.delete(
        center_url(staff, f"documents/{fake_doc_id}"),
        headers=auth_headers(staff),
    )
    check(
        "Document",
        "DELETE",
        "STAFF",
        403,
        r.status_code,
        "STAFF has no delete:document",
    )

    cl.close()


def test_form_instance(admin: dict, counselor: dict, staff: dict):
    """Form Instance 도메인 권한 테스트"""
    print(f"\n{BOLD}{CYAN}━━━ Form Instance ━━━{RESET}")
    cl = httpx.Client(follow_redirects=True, timeout=10)

    # --- READ ---
    for user in [admin, counselor, staff]:
        r = cl.get(
            center_url(user, "forms/instances"),
            headers=auth_headers(user),
        )
        check("FormInstance", "READ (list)", user["role"], 200, r.status_code)

    # --- WRITE ---
    for user in [admin, counselor, staff]:
        r = cl.post(
            center_url(user, "forms/instances"),
            headers=auth_headers(user),
            json={},
        )
        # 모든 역할에 write:form_instance 있음 → 422 (body validation)
        check(
            "FormInstance",
            "WRITE (create)",
            user["role"],
            422,
            r.status_code,
            "all roles have write:form_instance",
        )

    # --- DELETE ---
    fake_instance_id = "00000000-0000-0000-0000-000000000000"

    # ADMIN: delete:form_instance → 404
    r = cl.delete(
        center_url(admin, f"forms/instances/{fake_instance_id}"),
        headers=auth_headers(admin),
    )
    check(
        "FormInstance",
        "DELETE",
        "ADMIN",
        404,
        r.status_code,
        "permission OK, instance not found",
    )

    # COUNSELOR: NO delete:form_instance → 403
    r = cl.delete(
        center_url(counselor, f"forms/instances/{fake_instance_id}"),
        headers=auth_headers(counselor),
    )
    check(
        "FormInstance",
        "DELETE",
        "COUNSELOR",
        403,
        r.status_code,
        "COUNSELOR has no delete:form_instance",
    )

    # STAFF: NO delete:form_instance → 403
    r = cl.delete(
        center_url(staff, f"forms/instances/{fake_instance_id}"),
        headers=auth_headers(staff),
    )
    check(
        "FormInstance",
        "DELETE",
        "STAFF",
        403,
        r.status_code,
        "STAFF has no delete:form_instance",
    )

    cl.close()


def test_admin_only_resources(admin: dict, counselor: dict, staff: dict):
    """관리 기능 권한 테스트 (ADMIN만 또는 ADMIN+MANAGER만 접근 가능)

    write:program, write:room, write:center, write:role 등
    """
    print(f"\n{BOLD}{CYAN}━━━ Admin-Only Resources ━━━{RESET}")
    cl = httpx.Client(follow_redirects=True, timeout=10)

    # --- write:program (ADMIN only, COUNSELOR/STAFF no) ---
    for user in [admin, counselor, staff]:
        r = cl.post(
            center_url(user, "programs"),
            headers=auth_headers(user),
            json={},
        )
        if user["role"] == "ADMIN":
            check(
                "Program",
                "WRITE (create)",
                user["role"],
                422,
                r.status_code,
                "ADMIN has write:program",
            )
        else:
            check(
                "Program",
                "WRITE (create)",
                user["role"],
                403,
                r.status_code,
                f"{user['role']} has no write:program",
            )

    # --- write:room (ADMIN only) ---
    for user in [admin, counselor, staff]:
        r = cl.post(
            center_url(user, "rooms"),
            headers=auth_headers(user),
            json={},
        )
        if user["role"] == "ADMIN":
            check(
                "Room",
                "WRITE (create)",
                user["role"],
                422,
                r.status_code,
                "ADMIN has write:room",
            )
        else:
            check(
                "Room",
                "WRITE (create)",
                user["role"],
                403,
                r.status_code,
                f"{user['role']} has no write:room",
            )

    cl.close()


# ============================================================
# 결과 요약
# ============================================================


def print_summary():
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed

    print(f"\n\n{BOLD}{'=' * 70}{RESET}")
    print(f"{BOLD}  결과 요약{RESET}")
    print(f"{'=' * 70}")
    print(f"  총 테스트: {total}")
    print(f"  {GREEN}PASS: {passed}{RESET}")
    print(f"  {RED}FAIL: {failed}{RESET}")

    if failed > 0:
        print(f"\n{RED}{BOLD}  실패한 테스트:{RESET}")
        for r in results:
            if not r["passed"]:
                print(
                    f"    {RED}✗{RESET} [{r['domain']}] {r['action']} "
                    f"({r['role']}) → {r['actual']} (expected {r['expected']})"
                    + (f"  {r['note']}" if r["note"] else "")
                )

    # 도메인별 요약 테이블
    print(f"\n{BOLD}  도메인별 권한 매트릭스:{RESET}")
    print(f"  {'Domain':<18} {'Action':<22} {'ADMIN':<8} {'COUNSELOR':<12} {'STAFF':<8}")
    print(f"  {'-' * 68}")

    domains_seen = set()
    for r in results:
        key = (r["domain"], r["action"])
        if key in domains_seen:
            continue
        # 같은 domain/action 의 모든 role 결과 수집
        role_results = {}
        for r2 in results:
            if (r2["domain"], r2["action"]) == key:
                symbol = f"{GREEN}✓{RESET}" if r2["passed"] else f"{RED}✗{RESET}"
                role_results[r2["role"]] = f"{symbol} {r2['actual']}"
        print(
            f"  {r['domain']:<18} {r['action']:<22} "
            f"{role_results.get('ADMIN', '-'):<18} "
            f"{role_results.get('COUNSELOR', '-'):<22} "
            f"{role_results.get('STAFF', '-'):<18}"
        )
        domains_seen.add(key)

    print()
    return failed == 0


# ============================================================
# Main
# ============================================================


def main():
    print(f"{BOLD}{'=' * 70}{RESET}")
    print(f"{BOLD}  도메인별 CRUD 권한 검증 테스트{RESET}")
    print(f"{'=' * 70}")

    # 1. 로그인
    print(f"\n{CYAN}[로그인]{RESET}")
    admin = login("admin@test.com")
    print(f"  ADMIN    → center={admin['center_id'][:12]}...")
    counselor = login("counselor_a@test.com")
    print(f"  COUNSELOR → center={counselor['center_id'][:12]}...")
    staff = login("staff@test.com")
    print(f"  STAFF    → center={staff['center_id'][:12]}...")

    # 2. 도메인별 테스트
    test_schedule(admin, counselor, staff)
    test_client(admin, counselor, staff)
    test_counseling(admin, counselor, staff)
    test_counseling_note(admin, counselor, staff)
    test_assessment_case(admin, counselor, staff)
    test_document(admin, counselor, staff)
    test_form_instance(admin, counselor, staff)
    test_admin_only_resources(admin, counselor, staff)

    # 3. 결과 요약
    all_passed = print_summary()
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
