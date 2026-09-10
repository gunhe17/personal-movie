"""endpoint_health(test_14)가 안전상 skip한 42개 쓰기 라우트의 5xx 부재 검증 (C-4).

test_14는 시드/세션 훼손 방지로 비-center 쓰기(auth·self·persons·institutions 등)와
center 직속 파괴적 mutate(PATCH /centers/{id}·bulk·operating-times 등)를 호출 안 했다.
여기선 그것들을 **안전하게** 호출해 import/registration/배선 결함(5xx)이 없음을 확인한다.

안전 전략:
- 모든 path param을 DUMMY로(center_id 포함) → center 라우트는 require_membership에서 4xx로
  차단(변이 전). resource id DUMMY → 404. 빈 body → 대개 422.
- self-acting auth/me 라우트(DELETE /auth/me 등)는 토큰 계정에 작용하므로 **버림 계정**
  토큰으로 호출(시드 세션 무영향). 버림 계정 생성 실패 시 해당 라우트는 skip-기록.

판정: status<500 = ok. >=500 또는 raise = 회귀(하드 게이트).
"""
import re

import pytest

from .conftest import unique
from .test_11_pure_layer_sweep import DUMMY

_CENTER_PREFIX = "/api/v1/centers/{center_id}/"


def _resource_params(path: str) -> list[str]:
    return [p for p in re.findall(r"\{([^}]+)\}", path) if p != "center_id"]


def _is_skipped_write(path: str, method: str) -> bool:
    """test_14의 skip 술어 재현."""
    if method == "get":
        return False
    if path.startswith("/api/v1/admin") or path.startswith("/api/v1/internal"):
        return False
    if not path.startswith(_CENTER_PREFIX):
        return True  # non-center write
    if method in ("put", "patch", "delete") and not _resource_params(path):
        return True  # center-direct destructive
    return False


def _fill_dummy(path: str) -> str:
    return re.sub(r"\{[^}]+\}", DUMMY, path)


def _self_acting(path: str) -> bool:
    return path.startswith("/api/v1/auth/") or "/me/" in path or path.endswith("/me")


async def _throwaway_headers(api) -> dict | None:
    email = f"e2e-tw-{unique('x')}@example.com"
    pw = "Throwaway123"
    s = await api.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": pw,
              "person": {"name": "버림계정", "phone": "010-0000-0000"}},
    )
    if s.status_code not in (200, 201):
        return None
    lr = await api.post("/api/v1/auth/login", json={"email": email, "password": pw})
    if lr.status_code != 200:
        return None
    return {"Authorization": f"Bearer {lr.json()['access_token']}"}


async def test_skipped_writes_no_5xx(api, admin):
    from app.main import app
    spec = app.openapi()

    throwaway = await _throwaway_headers(api)

    rows: list[dict] = []
    skipped_self: list[str] = []
    for path, ops in sorted(spec["paths"].items()):
        for method in ("post", "put", "patch", "delete"):
            if method not in ops or not _is_skipped_write(path, method):
                continue
            self_acting = _self_acting(path)
            if self_acting and throwaway is None:
                skipped_self.append(f"{method.upper()} {path}")
                continue
            headers = throwaway if self_acting else admin["headers"]
            url = _fill_dummy(path)
            try:
                r = await api.request(method.upper(), url, json={}, headers=headers)
                status = r.status_code
                body = "" if status < 500 else r.text[:200]
            except Exception as e:  # ASGI re-raise = 5xx
                status, body = 500, f"raised {type(e).__name__}: {e}"
            rows.append({"method": method.upper(), "path": path, "status": status,
                         "body": body, "ok": status < 500})

    errs = [r for r in rows if not r["ok"]]
    print(f"\n=== SKIPPED WRITES === called={len(rows)} 5xx={len(errs)} "
          f"self_skipped(버림계정 실패)={len(skipped_self)}")
    for r in errs:
        print(f"  [5xx] {r['method']} {r['path']} :: {r['body'][:140]}")
    for s in skipped_self:
        print(f"  [self-skip] {s}")

    assert rows, "skip 대상 쓰기를 한 건도 호출 못함"
    assert not errs, f"{len(errs)}개 skip-쓰기가 5xx — 라우팅/배선 회귀"
