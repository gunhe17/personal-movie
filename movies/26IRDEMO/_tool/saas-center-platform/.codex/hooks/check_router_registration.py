"""PostToolUse 훅 — 모듈 `router.py`에 만든 APIRouter가 `app/modules/routers.py`에
등록되지 않은 채 남는 드리프트를 편집 직후 알린다.

목적: 라우터는 정의만으로는 앱에 안 붙는다. 등록의 단일 출처는 main.py이고, import의
단일 출처는 `app/modules/routers.py`다(server.md 조립층). 새 라우터를 만들고 등록을
빠뜨리면 테스트가 404를 낼 때까지 조용하다 — 지시는 보장이 아니므로 훅으로 알린다
(claude-files.md).

판정 범위 = **모듈 루트 `modules/{module}/router.py`만**. 서브모듈 router.py는 대개
부모가 `include_router`로 마운트하므로(assessment 7개·counseling 2개) 검사하면 소음이
된다 — 서브모듈 라우터를 직접 등록해야 하는 경우(counseling_case 등)는 이 훅이 못 잡는다.
정본 감사는 라우트 스냅샷(server.md 검증)이고, 이 훅은 가장 흔한 누락만 싸게 잡는다.

파일에 정의된 모듈 수준 `X = APIRouter(...)` 중, 같은 파일이 `include_router(X)`로
마운트하지도 않고 routers.py가 import하지도 않은 것을 보고한다. 항상 exit 0.
"""
from __future__ import annotations

import json
import os
import re
import sys


# #
# detect

ROUTER_FILE = re.compile(r"/apps/api/app/modules/([a-z0-9_]+)/router\.py$")
DEFINES = re.compile(r"^([a-z_][a-z0-9_]*)\s*=\s*APIRouter\(", re.MULTILINE)
INCLUDES = re.compile(r"\.include_router\(\s*([a-z_][a-z0-9_]*)")

REGISTRY = "apps/api/app/modules/routers.py"


def _unregistered(module: str, source: str, registry: str) -> list[str]:
    imported = set(
        re.findall(
            rf"^from app\.modules\.{module}\.router import (\w+)",
            registry,
            re.MULTILINE,
        )
    )
    mounted = set(INCLUDES.findall(source))
    return [
        name
        for name in DEFINES.findall(source)
        if name not in imported and name not in mounted
    ]


# #
# hook

def main() -> None:
    payload = json.load(sys.stdin)
    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    match = ROUTER_FILE.search(file_path)
    if not match:
        return

    project = os.environ.get("CLAUDE_PROJECT_DIR", "")
    with open(file_path, encoding="utf-8") as f:
        source = f.read()
    with open(os.path.join(project, REGISTRY), encoding="utf-8") as f:
        registry = f.read()

    missing = _unregistered(match.group(1), source, registry)
    if not missing:
        return

    listed = ", ".join(missing)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": (
                f"[라우터 미등록] {file_path}의 {listed}가 어디에도 안 붙어 있다 — "
                f"같은 파일의 include_router에도, app/modules/routers.py에도 없다.\n"
                f"→ 앱에 노출할 라우터면 routers.py에 "
                f"`from app.modules.{match.group(1)}.router import {missing[0]} as "
                f"{match.group(1)}_...` 형태로 import하고(이름 규약: `{{module}}_router` / "
                f"`{{module}}_{{name}}_router`), main.py의 `# router` 섹션에 "
                f"`server.router(Router(router=routers.…, prefix=…))` 한 줄로 등록한다.\n"
                f"→ 부모 라우터에 마운트할 것이면 같은 파일에서 include_router로 붙인다."
            ),
        }
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
