"""전 GET 엔드포인트 골든 러너 (모듈 + application read 포함).

OpenAPI에서 GET 경로를 읽어, path param을 시드 발굴 id로 치환해 인증 호출하고
정규화 응답을 기록한다. GET만 — 쓰기는 부수효과/시드 훼손 위험이라 제외(쓰기는 flow 테스트 담당).
admin/internal은 토큰/머신 아티팩트라 제외(스코프: 도메인 application read).

PRE(worktree)·POST 각각 돌려 golden_sweep_diff.py로 status+shape diff.
실행: bash scripts/run_e2e.sh -k endpoint_golden
"""
import json
import re
from pathlib import Path

from .test_11_pure_layer_sweep import build_ctx, Rec, DUMMY

OK = {200, 404}  # 정상 read 또는 없는-id 404. 5xx만 회귀 신호.


def _fill(path: str, pmap: dict) -> str:
    def repl(m):
        name = m.group(1)
        if name == "case_id":  # counseling vs assessment 동명 param 분기
            return pmap["counseling_case_id"] if "/counseling/" in path else DUMMY
        return pmap.get(name) or DUMMY
    return re.sub(r"\{([^}]+)\}", repl, path)


async def test_endpoint_golden(api):
    ctx = await build_ctx(api)

    # program_id 추가 발굴(build_ctx 미포함)
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
        "role_code": "counselor",
    }

    from app.main import app
    spec = app.openapi()

    rec = Rec()
    for path, ops in sorted(spec["paths"].items()):
        if "get" not in ops:
            continue
        if path.startswith("/api/v1/admin") or path.startswith("/api/v1/internal"):
            continue  # admin 토큰/machine — 스코프 외
        url = _fill(path, pmap)
        # 쿼리 필수 누락은 양쪽 동일 422라 무방. 옵셔널은 미전달.
        try:
            r = await api.get(url, headers=ctx["h"])
        except Exception as e:  # 앱 re-raise 예외 = server_error로 기록
            rec.add_exc("get", path, "GET", url, e)
            continue
        rec.add("get", path, "GET", url, r, OK)

    out = Path(__file__).parent / "_app_sweep_report.json"
    out.write_text(json.dumps(rec.rows, ensure_ascii=False, indent=2), encoding="utf-8")

    from collections import Counter
    c = Counter(x["verdict"] for x in rec.rows)
    print(f"\n=== ENDPOINT GOLDEN (GET) === total={len(rec.rows)} "
          f"ok={c['ok']} server_error={c['server_error']} client={c['client']}")
    for x in rec.rows:
        if x["verdict"] == "server_error":
            print(f"  [5xx] {x['path']}  ({x.get('note','')})")

    assert rec.rows, "GET 엔드포인트를 한 건도 호출 못함 — 컨텍스트 조립 실패"
