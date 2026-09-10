"""PostToolUse 훅 — agent form tool의 필드 계약이 갈라지는 편집을 잡아 동기화를 상기시킨다.

계약은 세 표면에 걸쳐 있다(정본 = 웹 디스크립터, README 참고):
  1. 폼 페이지/모달 (+page.svelte 등 — page-tools를 import해 등록하는 파일)
  2. 웹 디스크립터 (apps/web/src/lib/features/agent/page-tools/*.ts)
  3. 백엔드 prefill 스키마 (new_agent PREFILL_SPECS · 구 agent PREFILL_CONFIG)

어느 한 표면만 고치면 조용히 어긋난다 — 차단하지 않고 알림만(항상 exit 0).
실패는 조용히 통과.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

PAGE_TOOLS_DIR = "apps/web/src/lib/features/agent/page-tools/"
BACKEND_PREFILLS = (
    "apps/api/app/runtime/new_agent/common/prefill.py",
    "apps/api/app/runtime/agent/mutation/prefill.py",
)
README = "apps/web/src/lib/features/agent/page-tools/README.md"


def _notify(message: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": message,
        }
    }))


def main() -> None:
    payload = json.load(sys.stdin)
    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    if not file_path:
        return

    if file_path.endswith("README.md"):
        return

    if PAGE_TOOLS_DIR in file_path:
        _notify(
            "agent form tool 디스크립터/엔진 수정됨 — 필드 키를 추가/변경했다면 백엔드 "
            "PREFILL_SPECS(apps/api/app/runtime/new_agent/common/prefill.py)와 "
            "PREFILL_CONFIG(apps/api/app/runtime/agent/mutation/prefill.py)를 동기화했는지 확인. "
            f"불변식: {README}"
        )
        return

    if any(file_path.endswith(p) for p in BACKEND_PREFILLS):
        _notify(
            "백엔드 prefill 스키마 수정됨 — 필드 계약의 정본은 웹 디스크립터"
            f"({PAGE_TOOLS_DIR}*.ts)다. 필드 키·타입이 디스크립터와 일치하는지 확인. "
            f"불변식: {README}"
        )
        return

    # 폼 페이지/모달: page-tools를 import해 도구를 등록하는 웹 파일
    if "apps/web/" in file_path and file_path.endswith((".svelte", ".ts")):
        try:
            text = Path(file_path).read_text(encoding="utf-8")
        except OSError:
            return
        if "agent/page-tools" in text:
            _notify(
                "이 파일은 agent form tool이 배선된 폼이다 — 폼 필드를 추가/삭제/이름 변경했다면 "
                f"{PAGE_TOOLS_DIR}의 해당 디스크립터(FormSpec)를 같이 갱신해야 agent 자동 입력이 "
                f"안 깨진다. 불변식: {README}"
            )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
