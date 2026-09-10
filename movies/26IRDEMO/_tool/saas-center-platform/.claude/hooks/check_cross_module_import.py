"""PostToolUse 훅 — 편집한 modules/A/** 파일이 타 모듈 B의 내부(repository/models/service)를
직접 import 하는 cross-module-write.md §3 금지 신호를 잡아 컨텍스트에 주입.

목적: "모듈 비노출"은 지시일 뿐 강제가 없다(claude-files.md: 지시는 보장이 아니다 → hook으로 강제).
자율 loop이 owning facade 신설 대신 타 모듈 repository 직접 import 로 질러가는 최소저항 위반을
편집 직후 알린다. 차단하지 않는다 — 위반을 알려 LLM 이 §2(신설/이동/재사용)로 수렴하게 한다(항상 exit 0).

판정: modules/A 의 파일이 `from app.modules.B.(...).(repository|models|service|services)` (B≠A)를
새로 들였는가. 같은 모듈(B==A, 형제 서브모듈)·루트 facade import(`.facade`)·schemas 는 비매칭
(전자는 한 aggregate 허용, facade→facade 는 EX-12 sanctioned 예외라 noise 회피).
application/handlers 는 modules/ 밖이라 자동 면제(크로스모듈 조율의 유일 주체).
worker/·runtime/ 은 **ownerless-but-checked**(계층 14-5·12 R1) — 모듈이 아니지만 modules 내부
직접 import 는 전부 위반(도메인 접근은 facade/client/application handler 경유가 정본).
단 event 모듈(이벤트 아웃박스 = 워커/이벤팅 인프라)은 워커에서 정당(14-5 판별).

추가 축(2026-07-14): 모듈/runtime → application 역행. router.py(App Handler 배선)·worker
(application handler 경유가 정본)만 정당 — 그 외는 감사 스크립트 layering 갭과
동일 판정을 편집 직후 알린다(선례: llm gateway factory 의 기간 정산 roller 역참조 제거).

새로 들어온 텍스트(Edit: new_string, Write: content, MultiEdit: edits[].new_string)만 검사.
실패는 조용히 통과(exit 0).
"""
from __future__ import annotations

import json
import re
import sys


# #
# detect

MODULE_OF_FILE = re.compile(r"/apps/api/app/modules/([a-z0-9_]+)/")

# 모듈이 아니지만 modules 내부 직접 import 가 전부 위반인 영역(계층 14-5·12 R1)
NONMODULE_CHECKED = re.compile(r"/apps/api/app/(worker|runtime)/")

# 워커에서 정당한 대상 — event 모듈(이벤트 아웃박스 = 워커/이벤팅 인프라, 14-5 판별)
WORKER_EXEMPT_TARGETS = {"event"}

# from app.modules.{B}.....(repository|models|service|services)
FOREIGN_INTERNAL = re.compile(
    r"^\s*from\s+app\.modules\.([a-z0-9_]+)\.[\w.]*?(repository|models|services?)\b",
    re.M,
)

# 모듈 → runtime 역방향 (runtime.md §4)
MODULE_TO_RUNTIME = re.compile(r"^\s*from\s+app\.runtime\b", re.M)

# 모듈/runtime → application 역행 — router.py(App Handler 배선, cross-module-write.md §1)만 정당.
# worker 는 면제(worker.md — 도메인 접근이 application handler 경유가 정본인 유일 소비 런타임)
LAYER_TO_APPLICATION = re.compile(r"^\s*from\s+app\.application\b", re.M)
ROUTER_FILES = ("router.py", "router_legacy.py")

# agent facade 는 타 모듈 facade 도 금지 (agent-query.md 조립 위치 — 크로스모듈 이름 조립은 handler)
AGENT_FACADE_FILE = re.compile(r"/apps/api/app/modules/[a-z0-9_]+/facade/[a-z0-9_]*agent_facade[a-z0-9_]*\.py$")
FOREIGN_FACADE = re.compile(r"^\s*from\s+app\.modules\.([a-z0-9_]+)\.facade\b", re.M)


def _module_of_path(file_path: str) -> str | None:
    match = MODULE_OF_FILE.search(file_path)
    return match.group(1) if match else None


def _new_text(payload: dict) -> str:
    tool_input = payload.get("tool_input") or {}
    # Write
    if "content" in tool_input:
        return tool_input["content"] or ""
    # Edit
    if "new_string" in tool_input:
        return tool_input["new_string"] or ""
    # MultiEdit
    if "edits" in tool_input:
        return "\n".join(e.get("new_string", "") for e in tool_input["edits"])
    return ""


def _violations(*, owner: str, text: str, exempt: set[str] = frozenset()) -> list[str]:
    seen: list[str] = []
    for line in text.splitlines():
        match = FOREIGN_INTERNAL.match(line)
        if not match:
            continue
        target_module = match.group(1)
        if target_module == owner:
            continue  # 같은 모듈 형제 서브모듈 = 허용(한 aggregate)
        if target_module in exempt:
            continue  # 워커의 event 아웃박스 등 판별된 인프라
        stripped = line.strip()
        if stripped not in seen:
            seen.append(stripped)
    return seen


# #
# run

def main() -> None:
    payload = json.load(sys.stdin)

    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    owner = _module_of_path(file_path)
    exempt: set[str] = set()
    area = f"modules/{owner}" if owner else ""
    if owner is None:
        nm = NONMODULE_CHECKED.search(file_path)
        if nm is None:
            return  # application 등 = 면제(크로스모듈 조율의 유일 주체)
        # worker/runtime = ownerless-but-checked — modules 내부 import 전부 위반
        owner = ""
        area = nm.group(1)
        if area == "worker":
            exempt = set(WORKER_EXEMPT_TARGETS)

    text = _new_text(payload)
    violations = _violations(owner=owner, text=text, exempt=exempt)

    # 모듈 → runtime 역방향
    if owner:
        for line in text.splitlines():
            if MODULE_TO_RUNTIME.match(line):
                violations.append(f"{line.strip()}  ← 모듈→runtime 역방향(runtime.md §4) — 공유 계약은 app/core 로")

    # 모듈/runtime → application 역행 — router.py 배선·worker만 정당
    # (owner 는 non-module 영역에서 "" 로 재설정됨 — truthiness 로 가른다)
    is_router = file_path.endswith(ROUTER_FILES)
    module_side = bool(owner) and not is_router
    runtime_side = not owner and area == "runtime"
    if module_side or runtime_side:
        for line in text.splitlines():
            if LAYER_TO_APPLICATION.match(line):
                violations.append(
                    f"{line.strip()}  ← {'모듈' if module_side else 'runtime'}→application 역행"
                    f"({'audit layering 갭' if module_side else 'runtime.md §2'}) — 조율·시임은 application 이 위에서"
                    f"(선례: ai-calling.md 기간 정산 시임 — 게이트웨이 roller 역참조 제거, waiver 0)"
                )

    # agent facade 는 타 모듈 facade 도 금지 — 크로스모듈 이름 조립은 query handler 본문 인라인(agent-query.md)
    if owner and AGENT_FACADE_FILE.search(file_path):
        for line in text.splitlines():
            match = FOREIGN_FACADE.match(line)
            if match and match.group(1) != owner:
                violations.append(f"{line.strip()}  ← agent facade 의 타 모듈 facade import(agent-query.md 조립 위치)")

    if not violations:
        return

    listed = "\n".join(f"  - {v}" for v in violations)
    message = (
        f"[계층 경계 위반 의심] {area} 에 금지 방향 import (타 모듈 내부 직접 접근 "
        f"cross-module-write.md §3 / 모듈·runtime→application 역행 / 모듈→runtime 역방향):\n"
        f"{listed}\n"
        f"→ 수렴: 타 모듈 write 는 owning 모듈 루트 facade 메서드로 노출하고 application/handlers 에서 호출. "
        f"owning 모듈에 use-case 가 없으면 거기 신설(§2 신설/이동/재사용). read 집계는 application 에서 id 조회 후 조립.\n"
        f"→ 이식 함정(persistence-repository.md §8): model 을 옮기면 migrations/env.py·init-schema.py 등록 갱신, "
        f"내부 positional 호출은 kwarg 화, commit 후 model_validate 는 expire_on_commit=False 전제."
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": message,
        }
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
