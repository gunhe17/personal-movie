#!/usr/bin/env python
"""handler TOOL dict 빌드 가드 + 마이그레이션 진행률.

각 handler는 자기완결적 `TOOL` dict를 선언한다(core/tool_loader.py 규약).
이 스크립트가 전 handler를 불러와 `validate`를 돌려 누락·injected 노출·required
불일치를 빌드 타임에 잡는다. 아직 옛 문자열 형태(format_tool_for_embedding)인
handler는 '미마이그레이션'으로 집계한다 — 루프 진행률 표시용.

사용:
  uv run python scripts/check_tools.py          # 전체 검사, 실패 시 exit 1
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

from app.core.tool_loader import validate

_API_ROOT = Path(__file__).resolve().parent.parent


def _tool_modules() -> list[str]:
    mods = []
    for path in _API_ROOT.glob("app/**/*.py"):
        # 모듈 최상위 TOOL 선언만 (핸들러 규약)
        if any(line.startswith("TOOL = ") for line in path.read_text().splitlines()):
            mods.append(".".join(path.relative_to(_API_ROOT).with_suffix("").parts))
    return sorted(mods)


def main() -> int:
    migrated, legacy, failures = 0, 0, []

    for mod_name in _tool_modules():
        tool = getattr(importlib.import_module(mod_name), "TOOL")
        if not isinstance(tool, dict):
            legacy += 1
            continue
        migrated += 1
        try:
            validate(tool)
        except ValueError as e:
            failures.append(str(e))

    total = migrated + legacy
    print(f"TOOL: {total}개 (dict {migrated} / legacy {legacy})")
    if failures:
        print(f"\n검증 실패 {len(failures)}건:")
        for msg in failures:
            print(f"  - {msg}")
        return 1
    print("검증 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
