"""agent tool 수집 — TOOL 선언 핸들러를 모아 read/write로 가른다.

유일 수집 지점. agent_exposed=False(은퇴)는 제외, permission prefix로
read(always-load) / write(defer_loading)를 나눈다.

수집 범위 2곳:
- application/handlers: TOOL 선언 전부 (read 표면 + 크로스모듈 write)
- modules/*/handlers: permission이 write:/delete:인 TOOL만 — 단일모듈 write/action.
  read류는 query 포트가 커버하므로 안 걷는다. 구형 TOOL(permission 키 없음)은
  자동 스킵되므로, 모듈별 permission 부여 스윕이 도달하는 순서대로 노출이 늘어난다.
"""

from __future__ import annotations

import importlib
from pathlib import Path

from app.core.tool_loader import validate

_APP_ROOT = Path(__file__).resolve().parent.parent  # app/


def _iter_handler_modules():
    """파일시스템 기준 walk — __init__ 없는 namespace 패키지도 놓치지 않는다."""
    # query = agent 조회 SQL 슬라이스(EX-11) — 레이어 밖이라 별도 root (.claude/rules/api/query.md)
    roots = [_APP_ROOT / "application" / "handlers", _APP_ROOT / "modules", _APP_ROOT / "query"]
    for root in roots:
        for f in sorted(root.rglob("*.py")):
            if f.name.startswith("_"):
                continue
            if root.name == "modules" and "handlers" not in f.parts:
                continue
            rel = f.relative_to(_APP_ROOT.parent).with_suffix("")
            yield ".".join(rel.parts)


def iter_tool_modules():
    """노출 tool을 (tool_dict, handler_callable)로 yield.

    핸들러는 TOOL['name']과 동명이 기본(2026-07-10 전수 정렬 — 함수명 = 도구명).
    예외적으로 함수명을 도구명과 달리해야 하면 TOOL['fn']이 실제 함수명을 가리킨다.
    """
    for name in _iter_handler_modules():
        module = importlib.import_module(name)
        tool = getattr(module, "TOOL", None)
        if not isinstance(tool, dict) or not tool.get("agent_exposed", True):
            continue
        if name.startswith("app.modules."):
            # 모듈 write만 — permission 스윕 전 구형 TOOL(키 없음)은 여기서 걸러진다
            if not (tool.get("permission") or "").startswith(("write:", "delete:")):
                continue
        yield tool, getattr(module, tool.get("fn", tool["name"]))


def _iter_tools() -> list[dict]:
    return [tool for tool, _ in iter_tool_modules()]


def load_agent_tools() -> tuple[list[dict], list[dict]]:
    """(reads, writes) — read=always-load, write=defer_loading. 은퇴(agent_exposed=False) 제외."""
    tools = _iter_tools()
    for t in tools:
        validate(t)

    # 이름 = 도구 식별자 — 중복은 조용한 덮어쓰기가 되므로 빌드 타임에 터뜨린다
    # (알려진 충돌: create_template/create_session 등 모듈 간 동명 — 스윕 때 rename)
    seen: dict[str, int] = {}
    for t in tools:
        seen[t["name"]] = seen.get(t["name"], 0) + 1
    dups = sorted(n for n, c in seen.items() if c > 1)
    if dups:
        raise ValueError(f"tool 이름 중복 — 모듈 접두어로 rename 필요: {dups}")
    # prefill(page_path 마커)은 new_agent catalog가 항상 노출 — read/write 로딩·BM25 임베딩 대상 아님.
    loadable = [t for t in tools if not t.get("page_path")]
    # write는 write:/delete: 코드로 명확. 나머지(read:·None=membership 조회)는 always-load.
    writes = [t for t in loadable if (t["permission"] or "").startswith(("write:", "delete:"))]
    reads = [t for t in loadable if t not in writes]
    return reads, writes


def demo() -> None:
    reads, writes = load_agent_tools()
    total = len(reads) + len(writes)
    assert total > 0, "수집된 tool 0개 — 발견 경로 확인"
    assert all(t.get("agent_exposed", True) for t in reads + writes)
    assert all((t["permission"] or "").startswith(("write:", "delete:")) for t in writes)
    assert not any((t["permission"] or "").startswith(("write:", "delete:")) for t in reads)
    print(f"ok — reads={len(reads)} writes={len(writes)} total={total}")


if __name__ == "__main__":
    demo()
