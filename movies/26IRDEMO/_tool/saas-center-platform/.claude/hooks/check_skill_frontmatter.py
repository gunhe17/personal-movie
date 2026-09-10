"""PostToolUse 훅 — `.claude/skills/*/SKILL.md`가 claude-files.md 규약에서 벗어난 채
저장되는 것을 편집 직후 알린다.

목적: skill은 `description`으로 자동 로드된다 — 프론트매터가 깨지거나 `name`이 폴더명과
어긋나면 **하네스가 아예 트리거하지 않는다**(조용한 무효화). 그 외 스타일 규약(이모지·
체크/엑스 금지, 중요 지시는 위로)은 지시일 뿐 강제가 없어 드리프트한다.

기계 판정만 한다 — 프론트매터 존재·필수 키·name↔폴더명 일치·**이번 편집이 새로 들인**
이모지/체크기호. "트리거어가 앞에 있는가"·"중요 지시가 위에 있는가"는 판정 불가라
리마인더 한 줄로만 붙인다. 항상 exit 0.
"""
from __future__ import annotations

import json
import os
import re
import sys


# #
# detect

SKILL_FILE = re.compile(r"/\.claude/skills/([^/]+)/SKILL\.md$")
FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
KEY = re.compile(r"^([a-z][a-z-]*):\s*(.*)$", re.MULTILINE)

# claude-files.md: 이모지·체크/엑스 기호를 쓰지 않는다
DECORATION = re.compile(
    "[✅❌⭐\U0001f300-\U0001faff☀-➿]"
)

REMINDER = (
    "→ 규약(claude-files.md): description은 트리거어가 앞에("
    "사용자가 말할 법한 말), 중요 지시는 본문 위로(컴팩션 cap), 강조는 아껴서."
)


def _new_text(payload: dict) -> str:
    tool_input = payload.get("tool_input") or {}
    if "content" in tool_input:
        return tool_input["content"] or ""
    if "new_string" in tool_input:
        return tool_input["new_string"] or ""
    return "\n".join(
        edit.get("new_string") or "" for edit in tool_input.get("edits") or []
    )


def _problems(folder: str, source: str, added: str) -> list[str]:
    problems: list[str] = []

    match = FRONTMATTER.match(source)
    if not match:
        return [
            "프론트매터(`---` 블록)가 파일 맨 앞에 없다 — 하네스가 skill로 인식하지 못한다"
        ]

    keys = dict(KEY.findall(match.group(1)))
    for required in ("name", "description"):
        if not keys.get(required):
            problems.append(f"프론트매터 `{required}:`가 비어 있거나 없다")

    name = keys.get("name", "")
    if name and name != folder:
        problems.append(
            f"`name: {name}`이 폴더명 `{folder}`과 다르다 — 호출명은 폴더명이라 혼선"
        )

    decorations = sorted(set(DECORATION.findall(added)))
    if decorations:
        problems.append(
            f"이모지·체크/엑스 기호를 새로 들였다({''.join(decorations)}) — "
            f"대비는 `# good:`/`# bad:` 라벨로"
        )

    return problems


# #
# hook

def main() -> None:
    payload = json.load(sys.stdin)
    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    match = SKILL_FILE.search(file_path)
    if not match:
        return

    if not os.path.exists(file_path):
        return
    with open(file_path, encoding="utf-8") as f:
        source = f.read()

    problems = _problems(match.group(1), source, _new_text(payload))
    if not problems:
        return

    listed = "\n".join(f"  - {p}" for p in problems)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": f"[SKILL.md 규약]\n{listed}\n{REMINDER}",
        }
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
