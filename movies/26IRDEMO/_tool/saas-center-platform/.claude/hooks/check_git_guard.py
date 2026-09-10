"""PreToolUse 훅 — origin 접근(push/fetch/pull)·reset 을 차단.

사용자 정책(2026-06-24): origin 에 절대 접근하지 않고, reset 을 절대 하지 않는다.
settings.json 의 permissions.deny(git push/fetch/pull/reset prefix)가 1차 선언적 가드,
이 훅은 compound(`cd x && git push`)·옵션 삽입(`git -C /p reset --hard`) 같은 우회형까지 잡는 backstop.

Bash 명령에서 git 의 **서브커맨드가** push/fetch/pull/reset 이면 exit 2 로 차단(stderr 가 모델에 전달).
오탐 회피: git 이 **명령 위치**(문장 시작 또는 `;`·`&`·`|`·`(` 뒤)에 있고, git 다음의 **첫 비옵션 토큰**이
그 verb 일 때만 잡는다. 따옴표 속 산문·커밋 메시지·`origin/reset` 같은 인자에 든 단어는 통과.
잡는 형태: `git push`, `git reset --hard`, `cd x && git pull`, `git -C /p reset`.
통과: `git commit -m 'fix git reset bug'`, `echo "git push"`, `chore: git origin/reset 차단`.
git 별칭·env prefix(`FOO=bar git push`) 등 의도적 난독화는 범위 밖. 예외는 통과(exit 0, deny 규칙이 1차 가드).
"""
from __future__ import annotations

import json
import re
import sys


FORBIDDEN = re.compile(
    r"(?:^|[\n;&|(`])\s*git\s+(?:(?:-C|-c)\s+\S+\s+|--?\S+\s+)*(push|fetch|pull|reset)\b"
)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    if payload.get("tool_name") != "Bash":
        return 0

    command = (payload.get("tool_input") or {}).get("command") or ""
    match = FORBIDDEN.search(command)
    if not match:
        return 0

    op = match.group(1)
    sys.stderr.write(
        f"[git-guard] 차단: `git {op}` 는 금지된 작업입니다.\n"
        f"정책 — origin 접근(push/fetch/pull)·reset 영구 금지. "
        f"로컬 커밋/브랜치 작업만 진행하고, 원격 동기화·히스토리 되감기가 필요하면 사용자에게 알린다."
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
