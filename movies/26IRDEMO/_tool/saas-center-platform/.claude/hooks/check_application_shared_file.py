"""PreToolUse 훅 — application 레이어 `_` 공유 파일 신설을 편집 전에 차단.

application.md §1-1(2026-07-14 사용자 결정): application 레이어에 `_`-prefix 공유
헬퍼/레지스트리 파일을 신설하지 않는다 — 크로스모듈 해소 연쇄는 각 handler 본문 인라인,
감사 계약은 handler 파일 내 데이터 상수(PROJECTION 등), 진짜 공유는 owning facade 하강.

이 규칙은 예외 없는 파일 형태 금지라 advisory 가 아니라 deny 가 안전하다(오탐 0).
`__init__.py` 는 패키지 문법이라 제외. 실패는 조용히 통과(exit 0 — fail-open).
"""
from __future__ import annotations

import json
import re
import sys

BANNED = re.compile(r"/apps/api/app/application/.*/_[^/]*\.py$")


def main() -> None:
    payload = json.load(sys.stdin)
    file_path = (payload.get("tool_input") or {}).get("file_path") or ""

    if not BANNED.search(file_path) or file_path.endswith("__init__.py"):
        return

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                "[§1-1 위반 차단] application 레이어에 `_`-prefix 공유 파일 금지 "
                "(application.md §1-1, 사용자 결정 2026-07-14 — _projection.py 등 11개 인라인 회귀가 선례). "
                "→ 해소 연쇄는 각 handler 본문에 인라인(중복 감수), 감사 계약은 handler 파일 내 "
                "PROJECTION 같은 데이터 상수로, 진짜 공유 로직은 owning 모듈 facade 로 하강."
            ),
        }
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
