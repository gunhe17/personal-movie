#!/usr/bin/env python3
"""apps/web 시각 산출물(.svelte/.css) 편집 게이트.

이번 세션에서 `apps/web/Web_Design.md`(디자인 규칙 정본)를 읽지 않았으면 편집을 거부한다.
규칙 파일(.claude/rules/frontend/web.md)의 §5 요약만 보고 작업해 실측값이 어긋나는 사고
(모달 헤더 81px 등)를 구조적으로 차단하는 것이 목적.

PreToolUse — matcher: Write|Edit|MultiEdit|Bash
"""
import json
import os
import re
import sys

DESIGN_DOC = "apps/web/Web_Design.md"
TARGET_EXT = (".svelte", ".css")
# Bash 경유 파일 쓰기 신호 (auto 모드에서 sed/heredoc으로 고치는 경로도 게이트)
BASH_WRITE = re.compile(r"(sed\s+-i|>>?\s*\S+\.(svelte|css)|\btee\b|\bcp\b|\bmv\b)")
PATH_IN_CMD = re.compile(r"[\w./@-]*apps/web/[\w./@-]+\.(?:svelte|css)")


def targets(tool_name: str, tool_input: dict) -> list[str]:
    if tool_name in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        fp = tool_input.get("file_path") or ""
        return [fp] if fp else []
    if tool_name == "Bash":
        cmd = tool_input.get("command") or ""
        if not BASH_WRITE.search(cmd):
            return []
        return [m.group(0) for m in PATH_IN_CMD.finditer(cmd)]
    return []


def is_gated(path: str) -> bool:
    p = path.replace("\\", "/")
    if DESIGN_DOC in p:          # 정본 자체 편집은 통과
        return False
    if "apps/web/" not in p:
        return False
    return p.endswith(TARGET_EXT)


def read_design_doc_in_session(transcript_path: str) -> bool:
    """정본을 실제로 '읽는 tool_use'가 있었는지 확인.

    규칙 파일 본문이 컨텍스트에 실리면서 파일명이 등장하는 것은 통과로 치지 않는다 —
    반드시 Read/Bash/Grep tool_use의 입력에 정본 경로가 있어야 한다.
    """
    if not transcript_path or not os.path.exists(transcript_path):
        return True  # 판정 불가 시 열어둔다(작업 차단보다 안전)
    try:
        with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if "Web_Design.md" not in line:
                    continue
                try:
                    ev = json.loads(line)
                except json.JSONDecodeError:
                    continue
                content = (ev.get("message") or {}).get("content")
                if not isinstance(content, list):
                    continue
                for block in content:
                    if not isinstance(block, dict) or block.get("type") != "tool_use":
                        continue
                    name = block.get("name")
                    inp = block.get("input") or {}
                    if name in ("Read", "NotebookRead") and "Web_Design.md" in str(inp.get("file_path", "")):
                        return True
                    if name == "Bash" and "Web_Design.md" in str(inp.get("command", "")):
                        return True
                    if name in ("Grep", "Glob") and "Web_Design.md" in str(inp.get("path", "")):
                        return True
    except OSError:
        return True
    return False


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input") or {}

    gated = [p for p in targets(tool_name, tool_input) if is_gated(p)]
    if not gated:
        return 0

    if read_design_doc_in_session(payload.get("transcript_path", "")):
        return 0

    reason = (
        "🔴 디자인 정본 미확인 — 편집 차단.\n\n"
        f"대상: {gated[0]}\n\n"
        "apps/web의 .svelte/.css를 고치기 전에 디자인 규칙 정본 "
        "`apps/web/Web_Design.md`를 이번 세션에서 먼저 읽어야 한다.\n"
        ".claude/rules/frontend/web.md §5는 발췌일 뿐이며, 값이 어긋나면 항상 정본이 이긴다.\n\n"
        "지금 할 일:\n"
        "1. `apps/web/Web_Design.md`를 Read로 연다 "
        "(전체를 읽거나, 최소한 이번 작업에 해당하는 절 — Spacing / Rounded / "
        "Elevation / Components>{해당 컴포넌트} / Layout Patterns / Do's and Don'ts).\n"
        "2. 정본의 실측값을 확인한 뒤 같은 편집을 다시 시도한다.\n"
        "3. 정본에 없는 새 패턴이 필요하면 임의 생성하지 말고 사용자에게 먼저 제안한다."
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
