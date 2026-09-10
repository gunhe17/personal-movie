#!/usr/bin/env python3
"""apps/web 편집 내용의 디자인 스펙 위반 린터.

정본(apps/web/Web_Design.md)에서 명시적으로 금지된 값만 검출한다 — 판단이 갈리는
항목은 넣지 않는다(오탐이 쌓이면 경고 자체가 무시되므로).
방금 쓴 내용(new_string / content)만 검사하며 기존 코드는 건드리지 않는다.

PostToolUse — matcher: Write|Edit|MultiEdit
"""
import json
import os
import re
import sys

SPACING_UTILS = r"(?:gap|gap-x|gap-y|space-x|space-y|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml)"

# (정규식, 라벨, 정본 절)
RULES = [
    (re.compile(rf"(?<![\w-])-?{SPACING_UTILS}-\d*\.5(?![\w-])"),
     "비4배수 간격 — 간격은 4px 배수만(2·6·10·14 금지). "
     "예외: gap-1.5(6px)는 '인라인 세로 구분선 주변'에만 허용",
     "§Spacing"),
    (re.compile(rf"(?<![\w-])-?{SPACING_UTILS}-\[(\d+)px\]"),
     "임의 간격값 — 사다리(0·4·8·12·16·20·24·28·32·40·48·56·64·80·96) 밖",
     "§Spacing"),
    (re.compile(r"(?<![\w-])rounded-(?:md|3xl|norm)(?![\w-])"),
     "정의 밖 radius — radius는 4·8·12·16·pill 5개뿐(6·10·20·24 금지). "
     "카드/대형 컨테이너 16 = rounded-2xl, rounded-lg는 8px",
     "§Rounded"),
    (re.compile(r"(?<![\w-])rounded(?:-[trbl][lr]?)?-\[(\d+)px\]"),
     "임의 radius — 4·8·12·16·9999만 허용",
     "§Rounded"),
    (re.compile(r"(?<![\w-])font-(?:bold|extrabold|black)(?![\w-])"),
     "Bold 임의 사용 — 강조는 SemiBold까지. 타이틀은 무조건 semibold(600)",
     "§Do's and Don'ts"),
    (re.compile(r"(?<![\w-])text-[a-z0-9-]*(?<!semi)-bold(?![\w-])"),
     "타이포 variant가 bold — 타이틀/강조는 -semibold 사용(-bold 복붙 금지)",
     "§Typography · §Do's and Don'ts"),
    (re.compile(r"(?<![\w-])text-\[(\d+)px\]"),
     "등록 밖 폰트 크기 — 사다리(Display/Headline/Title/Body/Label/Caption)에서만 고른다",
     "§Typography"),
    (re.compile(r"(?<![\w-])border-l-(?:2|4|8)(?![\w-])"),
     "카드 좌측 액센트 보더 — 금지. 구분은 항상 1px 보더로, 상태는 chip·아이콘·배경 톤으로",
     "§Do's and Don'ts"),
]

# 모달/팝업 파일 전용 — 정본이 개별 조정으로 명시 금지한 패딩
MODAL_RULE = (
    re.compile(r"(?<![\w-])(?:p-6|px-6|py-6|px-8|py-5|pt-10)(?![\w-])"),
    "모달 패딩 개별 조정 금지 — header px-5 py-4(20/16) · body p-5(20) · footer px-5 pt-4 pb-5. "
    "좌우 20은 세 영역 공통",
    "§Components>modal",
)

HEX = re.compile(r"#[0-9a-fA-F]{6}(?![0-9a-fA-F])")


def written_text(tool_name: str, ti: dict) -> str:
    if tool_name == "Write":
        return ti.get("content") or ""
    if tool_name == "Edit":
        return ti.get("new_string") or ""
    if tool_name == "MultiEdit":
        return "\n".join((e or {}).get("new_string") or "" for e in ti.get("edits") or [])
    return ""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    tool_name = payload.get("tool_name", "")
    ti = payload.get("tool_input") or {}
    path = (ti.get("file_path") or "").replace("\\", "/")

    if "apps/web/" not in path or not path.endswith((".svelte", ".css")):
        return 0
    if "Web_Design.md" in path:
        return 0

    text = written_text(tool_name, ti)
    if not text.strip():
        return 0

    base = os.path.basename(path)
    hits: list[str] = []

    def add(match: str, label: str, section: str) -> None:
        line = f"  · `{match}` — {label}  [{section}]"
        if line not in hits:
            hits.append(line)

    for rx, label, section in RULES:
        for m in rx.finditer(text):
            raw = m.group(0)
            # 4의 배수 임의값은 통과 (gap-[24px] 등)
            if m.groups() and m.group(1) and m.group(1).isdigit():
                n = int(m.group(1))
                if "rounded" in raw and n in (4, 8, 12, 16):
                    continue
                if "rounded" not in raw and "text-[" not in raw and n % 4 == 0:
                    continue
            add(raw, label, section)

    is_modal = "/modal/" in path or "Modal" in base or "Popup" in base or "Confirm" in base
    if is_modal:
        rx, label, section = MODAL_RULE
        for m in rx.finditer(text):
            add(m.group(0), label, section)

    # 아이콘 컴포넌트는 유채색 hex 유지가 정본 규칙이므로 제외
    is_icon = "/icons/" in path.lower() or base.startswith("Icon")
    if not is_icon:
        for m in HEX.finditer(text):
            add(m.group(0), "raw hex 직접 사용 — 토큰/팔레트 클래스로", "§Do's and Don'ts")

    if not hits:
        return 0

    body = (
        f"⚠️ 디자인 스펙 점검 — {base}에 방금 쓴 내용에서 정본 위반 후보 {len(hits)}건:\n"
        + "\n".join(hits)
        + "\n\napps/web/Web_Design.md의 해당 절을 열어 확인하고, 의도한 예외가 아니면 고친다. "
        "예외라면 왜 예외인지 사용자에게 한 줄로 알린다."
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": body,
        },
        "systemMessage": f"⚠️ 디자인 스펙 위반 후보 {len(hits)}건 — {base}",
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
