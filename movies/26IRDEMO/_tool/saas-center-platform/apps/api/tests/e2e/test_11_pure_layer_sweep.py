"""PURE 레이어(Router → Handler → Service → Repository) 124개 엔드포인트 스윕.

PURE-LAYER-API-2026-06-30.md의 목록을 대상으로, 견고한 단일 루프로 전 엔드포인트를
호출하고 결과를 기록한다. 실패해도 멈추지 않고 전부 수집한다(테스트 수정은 별도 결정).

판정:
- ok          : status ∈ expected (정상)
- server_error: status >= 500 (리팩토링 회귀 후보 — 최우선 기록 대상)
- client      : 4xx (입력/픽스처/권한 — 회귀 아님, 사유 기록)
- harness_error: 호출 자체가 예외(픽스처 조립 실패 등)

픽스처 한계(시드에 없는 엔티티: assessment-case/document/field-note/notice)는 더미 UUID로
호출해 "엔드포인트가 깔끔히 404를 내는지 vs 500으로 깨지는지"를 가린다.

리포트: tests/e2e/_pure_sweep_report.md + _pure_sweep_report.json (루트 출력은 요약).
실행: bash scripts/run_e2e.sh -k pure_layer_sweep -s
"""
import json
import re
import uuid
from pathlib import Path

from httpx import AsyncClient

from .conftest import login_as

DUMMY = "00000000-0000-0000-0000-000000000000"

# 골든마스터 정규화 — 시드마다 다른 휘발값을 토큰으로 치환해 전/후 byte 비교 가능케
_UUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
_TS = re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?")
_VOL_KEYS = {
    "access_token", "refresh_token", "token", "url", "download_url",
    "presigned_url", "created_at", "updated_at", "deleted_at", "expires_at",
}


def _norm(v):
    if isinstance(v, dict):
        return {k: ("<vol>" if k in _VOL_KEYS else _norm(x)) for k, x in sorted(v.items())}
    if isinstance(v, list):
        return [_norm(x) for x in v]
    if isinstance(v, str):
        if _UUID.fullmatch(v):
            return "<id>"
        if _TS.fullmatch(v):
            return "<ts>"
    return v


def normalize_body(resp) -> str:
    try:
        return json.dumps(_norm(resp.json()), ensure_ascii=False, sort_keys=True)
    except Exception:
        return _TS.sub("<ts>", _UUID.sub("<id>", resp.text))[:2000]


# ═══════════════════════════════════════════════════════════════════
# Recorder
# ═══════════════════════════════════════════════════════════════════

class Rec:
    def __init__(self):
        self.rows: list[dict] = []

    def add(self, group, name, method, path, resp, expected, emits=False, note=""):
        status = resp.status_code
        if status in expected:
            verdict = "ok"
        elif status >= 500:
            verdict = "server_error"
        else:
            verdict = "client"
        nbody = normalize_body(resp)
        body = ""
        if verdict != "ok":
            body = nbody[:280]
        self.rows.append({
            "group": group, "name": name, "method": method, "path": path,
            "status": status, "verdict": verdict, "emits": emits,
            "note": note, "body": body, "nbody": nbody,
        })

    def add_exc(self, group, name, method, path, exc, emits=False):
        # ASGI transport는 앱의 미처리 예외를 호출부로 re-raise한다(500 응답 아님).
        # 따라서 raise된 DevelopError 등을 server_error로 기록하고 루프는 계속한다.
        nbody = _TS.sub("<ts>", _UUID.sub("<id>", str(exc)))[:2000]
        self.rows.append({
            "group": group, "name": name, "method": method, "path": path,
            "status": 500, "verdict": "server_error", "emits": emits,
            "note": f"raised {type(exc).__name__}", "body": nbody[:280],
            "nbody": f"<raised {type(exc).__name__}> {nbody}",
        })

    def error(self, group, name, exc):
        self.rows.append({
            "group": group, "name": name, "method": "-", "path": "-",
            "status": 0, "verdict": "harness_error", "emits": False,
            "note": f"{type(exc).__name__}: {exc}", "body": "",
        })


# ═══════════════════════════════════════════════════════════════════
# Context — 인증 세션 + 시드 id 발굴 + admin 플랫폼 토큰
# ═══════════════════════════════════════════════════════════════════

async def _discover_items(api, session, path, params=None):
    r = await api.get(
        f"/api/v1/centers/{session['center_id']}{path}",
        params=params, headers=session["headers"],
    )
    if r.status_code != 200:
        return []
    body = r.json()
    return body.get("items", body) if isinstance(body, dict) else body


async def _mint_admin_token() -> str | None:
    """super_admin access token 직접 발급(2FA 우회 — /admin은 super_admin 요구)."""
    try:
        from sqlalchemy import select
        from app.infrastructure.persistence.database import AsyncSessionLocal
        from app.modules.platform_admin.admin_account.models import AdminAccount
        from app.modules.platform_admin.admin_account.repository import (
            AdminAccountRepository,
        )
        from app.modules.platform_admin.admin_account.services.create_admin_access_token import (  # noqa: E501
            CreateAdminAccessTokenService,
        )

        async with AsyncSessionLocal() as s:
            admin = (
                await s.execute(
                    select(AdminAccount).where(
                        AdminAccount.email == "imomtae@insighter.co.kr"  # super_admin
                    )
                )
            ).scalar_one_or_none()
            if admin is None:
                return None
            token, _ = await CreateAdminAccessTokenService(
                AdminAccountRepository(s)
            ).execute(admin.id)
            return token
    except Exception:
        return None


async def _ensure_lazy_tables() -> None:
    """지연 import 모델(라우터가 함수 내 import)은 conftest create_all 시점에 미등록 →
    테이블 누락. 모델을 명시 import해 메타데이터에 올린 뒤 create_all 재실행(idempotent).
    e2e 한정 보정 — 프로덕션은 alembic 마이그레이션이 테이블을 만든다."""
    try:
        from app.infrastructure.persistence.database import AsyncSessionLocal
        from app.infrastructure.persistence.models import BaseModel
        from app.modules.counseling.counseling_case_analysis import models  # noqa: F401

        engine = AsyncSessionLocal.kw["bind"]
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
    except Exception:
        pass


async def _real_counseling_case_id(center_id: str) -> str | None:
    try:
        from sqlalchemy import select
        from app.infrastructure.persistence.database import AsyncSessionLocal
        from app.modules.counseling.counseling_case.models import CounselingCase

        async with AsyncSessionLocal() as s:
            row = (
                await s.execute(
                    select(CounselingCase.id)
                    .where(CounselingCase.center_id == center_id)
                    .limit(1)
                )
            ).scalar_one_or_none()
            return str(row) if row else None
    except Exception:
        return None


async def build_ctx(api: AsyncClient) -> dict:
    await _ensure_lazy_tables()
    manager = await login_as(api, "manager")
    admin = await login_as(api, "admin")
    ctx: dict = {
        "manager": manager,
        "admin": admin,
        "center_id": manager["center_id"],
        "account_id": manager["account_id"],
        "person_id": manager["person_id"],
        "h": manager["headers"],
    }

    clients = await _discover_items(api, manager, "/clients/", {"page": 1, "size": 100})
    ctx["client_id"] = clients[0]["id"] if clients else None
    ctx["client_id2"] = clients[1]["id"] if len(clients) > 1 else None

    members = await _discover_items(api, manager, "/members/", {"page": 1, "size": 100})
    ctx["member_id"] = members[0]["id"] if members else None

    rooms = await _discover_items(api, manager, "/rooms/")
    ctx["room_id"] = rooms[0]["id"] if rooms else None

    cas = await _discover_items(api, manager, "/center-assessments")
    if cas:
        ctx["assessment_id"] = (
            cas[0].get("assessment_id")
            or (cas[0].get("assessment") or {}).get("id")
            or cas[0].get("id")
        )
    else:
        ctx["assessment_id"] = None

    cases = await _discover_items(api, manager, "/counseling/cases/", {"page": 1, "size": 50})
    ctx["counseling_case_id"] = (
        cases[0]["id"] if cases else await _real_counseling_case_id(ctx["center_id"])
    )

    docs = await _discover_items(api, manager, "/documents/", {"page": 1, "size": 20})
    ctx["document_id"] = docs[0]["id"] if docs else None

    # role list (다른 prefix)
    rr = await api.get("/api/v1/role/roles/", headers=manager["headers"])
    if rr.status_code == 200:
        rb = rr.json()
        items = rb.get("items", rb) if isinstance(rb, dict) else rb
        ctx["role_id"] = items[0]["id"] if items else None
    else:
        ctx["role_id"] = None

    token = await _mint_admin_token()
    ctx["admin_token"] = token
    ctx["ah"] = {"Authorization": f"Bearer {token}"} if token else {}
    return ctx


# ═══════════════════════════════════════════════════════════════════
# Spec helpers
# ═══════════════════════════════════════════════════════════════════

OK_READ = {200}
OK_READ_OR_MISSING = {200, 404}
OK_WRITE = {200, 201, 204}
OK_WRITE_OR_MISSING = {200, 201, 204, 404}


# spec 함수들은 아래 SPECS에 등록. 각 함수: async (api, ctx, rec) -> None
# 분리된 파일 _pure_sweep_specs.py 에서 import (가독성 위해 분할).
from ._pure_sweep_specs import SPECS  # noqa: E402


# ═══════════════════════════════════════════════════════════════════
# 루프
# ═══════════════════════════════════════════════════════════════════

async def test_pure_layer_sweep(api):
    ctx = await build_ctx(api)
    rec = Rec()

    for group, name, fn in SPECS:
        try:
            await fn(api, ctx, rec)
        except Exception as e:  # 견고성: 한 spec 실패가 루프를 멈추지 않음
            rec.error(group, name, e)

    _write_report(ctx, rec)

    # 요약(루트 출력)
    from collections import Counter
    c = Counter(r["verdict"] for r in rec.rows)
    print("\n=== PURE LAYER SWEEP ===")
    print(f"total calls={len(rec.rows)}  ok={c['ok']}  "
          f"server_error={c['server_error']}  client={c['client']}  "
          f"harness_error={c['harness_error']}")
    server_errs = [r for r in rec.rows if r["verdict"] == "server_error"]
    print(f"\nSERVER ERRORS ({len(server_errs)}):")
    for r in server_errs:
        print(f"  [{r['status']}] {r['method']} {r['path']}  ({r['name']})")

    # 기록이 목적 — 하드 실패 없음. 호출이 0이면 픽스처 조립 실패이므로 그때만 fail.
    assert rec.rows, "스윕이 한 건도 호출하지 못함 — 컨텍스트 조립 실패"


def _write_report(ctx, rec):
    out_dir = Path(__file__).parent
    (out_dir / "_pure_sweep_report.json").write_text(
        json.dumps(rec.rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    from collections import Counter
    c = Counter(r["verdict"] for r in rec.rows)
    lines = [
        "# PURE 레이어 스윕 결과",
        "",
        f"- 컨텍스트: center_id={bool(ctx.get('center_id'))} "
        f"client_id={bool(ctx.get('client_id'))} "
        f"counseling_case_id={bool(ctx.get('counseling_case_id'))} "
        f"admin_token={bool(ctx.get('admin_token'))}",
        f"- 총 호출 {len(rec.rows)}: ok={c['ok']} "
        f"server_error={c['server_error']} client={c['client']} "
        f"harness_error={c['harness_error']}",
        "",
        "## SERVER ERRORS (5xx — 회귀 후보)",
        "",
        "| status | method | path | spec | body |",
        "|---|---|---|---|---|",
    ]
    for r in rec.rows:
        if r["verdict"] == "server_error":
            lines.append(
                f"| {r['status']} | {r['method']} | {r['path']} | {r['name']} | "
                f"{r['body'].replace('|', '/')[:160]} |"
            )
    lines += ["", "## CLIENT 4xx (입력/픽스처/권한)", "",
              "| status | method | path | spec | body |", "|---|---|---|---|---|"]
    for r in rec.rows:
        if r["verdict"] == "client":
            lines.append(
                f"| {r['status']} | {r['method']} | {r['path']} | {r['name']} | "
                f"{r['body'].replace('|', '/')[:160]} |"
            )
    lines += ["", "## HARNESS ERRORS", ""]
    for r in rec.rows:
        if r["verdict"] == "harness_error":
            lines.append(f"- {r['name']}: {r['note']}")
    lines += ["", "## 전체 OK 목록", ""]
    for r in rec.rows:
        if r["verdict"] == "ok":
            lines.append(f"- [{r['status']}] {r['method']} {r['path']} ({r['name']})")

    (out_dir / "_pure_sweep_report.md").write_text("\n".join(lines), encoding="utf-8")
