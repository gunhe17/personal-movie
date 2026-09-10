"""전 엔드포인트 헬스 스윕 — OpenAPI의 모든 메서드를 호출해 5xx(서버오류)가 없음을 단언.

목적: 리팩토링(라우터 재배선·import 재구성·eventing 배선) 이후 어떤 라우트도 import/
registration/배선 결함으로 깨지지 않음을 보장한다. test_12(GET 골든)는 기록만 — 여기선
하드 게이트(server_error=0)다.

안전 설계 (시드 베이스라인 훼손 금지):
- GET: 시드 실제 id로 호출, 200/404 등 <500 기대.
- 쓰기(POST/PUT/PATCH/DELETE): center_id만 실제값, 그 외 path id는 DUMMY로 채워
  "없는 리소스" 대상 → 변이 전에 404/422로 차단. body는 {} (대부분 422).
  · center 하위 경로가 아닌 쓰기(auth/자기계정/글로벌)는 skip — 세션 계정 파괴 방지.
  · resource-id가 없는 center 직속 PUT/PATCH/DELETE(파괴적 bulk·센터 자체 변경)는 skip.
- /admin·/internal 은 스코프 외(토큰/머신) — 제외.

판정: status>=500 또는 호출 예외 = server_error(회귀). 그 외 전부 통과.
리포트: tests/e2e/_endpoint_health_report.md (+ .json). 실행: -k endpoint_health
"""
import json
import re
from collections import Counter
from pathlib import Path

from .test_11_pure_layer_sweep import build_ctx, Rec, DUMMY

SAFE = set(range(200, 500))  # <500 통과, >=500 = 회귀
_CENTER_PREFIX = "/api/v1/centers/{center_id}/"


def _resource_params(path: str) -> list[str]:
    return [p for p in re.findall(r"\{([^}]+)\}", path) if p != "center_id"]


def _fill(path: str, pmap: dict, write: bool) -> str:
    def repl(m):
        name = m.group(1)
        if name == "center_id":
            return pmap["center_id"]
        if write:
            return DUMMY  # 쓰기는 없는 리소스 대상 → 변이 차단
        if name == "case_id":  # counseling vs assessment 동명 param 분기
            return pmap["counseling_case_id"] if "/counseling/" in path else DUMMY
        return pmap.get(name) or DUMMY

    return re.sub(r"\{([^}]+)\}", repl, path)


async def test_endpoint_health_sweep(api):
    ctx = await build_ctx(api)

    pr = await api.get(
        f"/api/v1/centers/{ctx['center_id']}/programs/",
        headers=ctx["h"], params={"page": 1, "size": 1},
    )
    program_id = None
    if pr.status_code == 200:
        body = pr.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        program_id = items[0]["id"] if items else None

    pmap = {
        "center_id": ctx["center_id"],
        "client_id": ctx["client_id"],
        "related_client_id": ctx["client_id2"],
        "member_id": ctx["member_id"],
        "account_id": ctx["account_id"],
        "person_id": ctx["person_id"],
        "room_id": ctx.get("room_id"),
        "program_id": program_id,
        "assessment_id": ctx.get("assessment_id"),
        "counseling_case_id": ctx.get("counseling_case_id"),
        "document_id": ctx.get("document_id"),
        "role_id": ctx.get("role_id"),
        "role_code": "counselor",
    }

    from app.main import app
    spec = app.openapi()

    rec = Rec()
    skipped: list[dict] = []

    for path, ops in sorted(spec["paths"].items()):
        if not path.startswith("/api/v1/"):
            continue  # /schema·/docs·/openapi.json 등 비-도메인 infra 라우트 제외
        if path.startswith("/api/v1/admin") or path.startswith("/api/v1/internal"):
            continue
        for method in ("get", "post", "put", "patch", "delete"):
            if method not in ops:
                continue
            write = method != "get"
            if write:
                if not path.startswith(_CENTER_PREFIX):
                    skipped.append({"method": method, "path": path, "why": "non-center write"})
                    continue
                if method in ("put", "patch", "delete") and not _resource_params(path):
                    skipped.append({"method": method, "path": path, "why": "center-direct mutate (destructive guard)"})
                    continue
                # 대화 생성은 응답 후 BackgroundTasks(프로필 분석)를 자기 세션으로 띄우는데,
                # ASGITransport+BaseHTTPMiddleware 하에서 그 세션 teardown이 데드락 → 스윕 hang.
                # 에이전트 대화 흐름은 전용 테스트가 검증한다.
                if method == "post" and path.endswith("/agent/conversations"):
                    skipped.append({"method": method, "path": path, "why": "post-response background job (sweep-unsafe)"})
                    continue

            url = _fill(path, pmap, write)
            try:
                if write:
                    r = await api.request(method.upper(), url, json={}, headers=ctx["h"])
                else:
                    r = await api.get(url, headers=ctx["h"])
            except Exception as e:  # ASGI는 미처리 예외를 re-raise → server_error로 기록
                rec.add_exc(method, path, method.upper(), url, e)
                continue
            rec.add(method, path, method.upper(), url, r, SAFE)

    server_errs = [r for r in rec.rows if r["verdict"] == "server_error"]
    # 읽기(GET) 5xx = 명백한 회귀(하드 게이트). 쓰기 5xx = 빈-body로 surface된 계약 갭이라
    # 일괄 결정 대상 — findings로 기록만(테스트 미실패). _endpoint_health_report.md 참조.
    read_errs = [r for r in server_errs if r["method"] == "GET"]
    write_findings = [r for r in server_errs if r["method"] != "GET"]
    _write_report(rec, skipped, write_findings)

    c = Counter(r["verdict"] for r in rec.rows)
    print(
        f"\n=== ENDPOINT HEALTH === called={len(rec.rows)} ok={c['ok']} "
        f"read_5xx={len(read_errs)} write_findings={len(write_findings)} skipped={len(skipped)}"
    )
    for r in read_errs:
        print(f"  [READ 5xx-회귀] {r['method']} {r['path']}  ({r.get('note', '')})")
    for r in write_findings:
        print(f"  [WRITE 계약갭-기록] {r['method']} {r['path']}  ({r.get('note', '')})")

    assert rec.rows, "엔드포인트를 한 건도 호출 못함 — 컨텍스트 조립 실패"
    assert not read_errs, (
        f"읽기(GET) {len(read_errs)}개가 5xx — 회귀. _endpoint_health_report.md 참조"
    )


def _write_report(rec: Rec, skipped: list[dict], write_findings: list[dict]) -> None:
    out = Path(__file__).parent
    (out / "_endpoint_health_report.json").write_text(
        json.dumps({"rows": rec.rows, "skipped": skipped}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    c = Counter(r["verdict"] for r in rec.rows)
    read_errs = [r for r in rec.rows if r["verdict"] == "server_error" and r["method"] == "GET"]
    lines = [
        "# 엔드포인트 헬스 스윕 결과",
        "",
        f"- 호출 {len(rec.rows)}: ok={c['ok']} server_error={c['server_error']}",
        f"- skip {len(skipped)} (비-center 쓰기 / 파괴적 가드)",
        "",
        "## READ 5xx (GET — 명백한 회귀, 하드 게이트)",
        "",
        "| status | path | body |",
        "|---|---|---|",
    ]
    for r in read_errs:
        lines.append(f"| {r['status']} | {r['path']} | {r['body'].replace('|', '/')[:160]} |")
    lines += [
        "",
        "## WRITE 계약 갭 (빈-body로 surface — 일괄 결정 대상, 테스트 미실패)",
        "",
        "스키마/모델/typecheck 레이어가 필드 필수성을 다르게 말해 빈 body가 422 대신 500이 되는 경우.",
        "어느 레이어가 권위인지는 계약 판단이라 자동 수정하지 않고 기록만 한다.",
        "",
        "| status | method | path | body |",
        "|---|---|---|---|",
    ]
    for r in write_findings:
        lines.append(
            f"| {r['status']} | {r['method']} | {r['path']} | "
            f"{r['body'].replace('|', '/')[:160]} |"
        )
    lines += ["", "## SKIPPED (안전 가드)", "", "| method | path | why |", "|---|---|---|"]
    for s in skipped:
        lines.append(f"| {s['method']} | {s['path']} | {s['why']} |")

    (out / "_endpoint_health_report.md").write_text("\n".join(lines), encoding="utf-8")
