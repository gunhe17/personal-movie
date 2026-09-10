"""PostToolUse 훅 — X1 파라미터 폭발 규약 감시(apps/api 파이썬 파일).

X1(convention loop): 함수/메서드 **정의**에 파라미터가 있으면 각 파라미터를 한 줄에 하나 + 후행 콤마.
self-only·무인자는 인라인 허용. 호출부는 대상 아님.

advisory — 차단하지 않는다(항상 exit 0). 새로 들어온 텍스트만 검사해 collapsed 다중파라미터
def 를 발견하면 컨텍스트로 알린다(9-4 hook과 동일 정책: 지시는 보장이 아니다 → hook이 수렴시킴).
"""
from __future__ import annotations

import ast
import json
import re
import sys

API_FILE = re.compile(r"/apps/api/.*\.py$")


def _new_text(payload: dict) -> str:
    tool_input = payload.get("tool_input") or {}
    if "content" in tool_input:
        return tool_input["content"] or ""
    if "new_string" in tool_input:
        return tool_input["new_string"] or ""
    if "edits" in tool_input:
        return "\n".join(e.get("new_string", "") for e in tool_input["edits"])
    return ""


def _collapsed_defs(text: str) -> list[str]:
    """한 줄에 파라미터 2개 이상(self 제외 1개 이상 + 총 2개 이상)이 접힌 def 를 찾는다."""
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return []  # 편집 조각이라 파싱 불가 = 판단 불가, 조용히 통과
    found: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        args = node.args
        all_args = [*args.posonlyargs, *args.args, *args.kwonlyargs]
        names = [a.arg for a in all_args]
        if args.vararg:
            names.append(args.vararg.arg)
        non_self = [n for n in names if n not in ("self", "cls")]
        if len(non_self) < 1 or len(names) < 2:
            continue  # self-only·무인자·단일 인자 = 인라인 허용
        # 모든 파라미터가 서로 다른 줄인가
        linenos = {a.lineno for a in all_args}
        if args.vararg:
            linenos.add(args.vararg.lineno)
        if len(linenos) < len(names):
            found.append(node.name)
    return found


def main() -> None:
    payload = json.load(sys.stdin)
    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    if not API_FILE.search(file_path):
        return
    collapsed = _collapsed_defs(_new_text(payload))
    if not collapsed:
        return
    listed = ", ".join(collapsed[:5])
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": (
                f"[X1 파라미터 폭발] 정의의 파라미터가 한 줄에 접혀 있다: {listed}. "
                f"규약: 파라미터 2개 이상이면 각 파라미터를 한 줄에 하나 + 후행 콤마"
                f"(self-only·단일 인자는 인라인 허용). 호출부는 대상 아님."
            ),
        }
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
