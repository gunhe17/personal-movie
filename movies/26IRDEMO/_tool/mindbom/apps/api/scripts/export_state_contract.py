"""검사 상태 계약을 언어 중립 JSON으로 내보낸다.

왜 필요한가
-----------
상태·전이 규칙의 정본은 백엔드 state_machine.py다. 그런데 프론트도 같은
상태를 알아야 하고(술어·필터·차트 범례), 두 언어가 그 지식을 각자 손으로
적으면 어긋나도 아무도 모른다 — 타입 체크는 언어 경계를 못 넘는다.

기존 test_exam_types.py는 프론트 소스를 정규식으로 읽어 대조했는데,
선언이 registry로 옮겨가자 정규식이 못 찾아 조용히 깨졌다(실패 2건).
소스 파싱은 리팩터링에 취약하다.

그래서 이 스크립트가 계약을 데이터로 고정하고, 양쪽 테스트가 같은 파일을
읽는다. 상태를 바꾸면 이 파일이 바뀌고, 그 diff가 곧 "무엇이 달라졌나"다.

쓰는 법
-------
    uv run python -m scripts.export_state_contract          # 파일 갱신
    uv run python -m scripts.export_state_contract --check  # 최신인지 확인만

--check는 CI용이다. state_machine.py를 고치고 이 파일을 안 만들면 실패한다.
"""
import argparse
import json
import sys
from pathlib import Path

from app.modules.examination.common.platform_mapping import (
    build_mapping_contract,
)
from app.modules.examination.common.schemas import SUPPORTED_EXAM_TYPES
from app.modules.examination.common.state_machine import (
    ALL_STATUSES,
    CONFIRMED_STATUSES,
    STATUS_LABELS,
    VALID_TRANSITIONS,
    can_transition,
)

# apps/api/scripts/ → 리포지토리 루트
CONTRACT_PATH = (
    Path(__file__).resolve().parents[3] / "contracts" / "exam-state.json"
)


def build_contract() -> dict:
    """상태 계약 — 전이는 전수(N×N)로 펼쳐 적는다.

    허용 목록만 적으면 "여기 없으면 거부"라는 규칙을 읽는 쪽이 다시
    구현해야 한다. 전수로 적으면 소비자는 표를 조회만 하면 된다.
    """
    return {
        "_comment": (
            "자동 생성 — 직접 고치지 말 것. "
            "정본은 apps/api/app/modules/examination/common/state_machine.py, "
            "갱신은 `uv run python -m scripts.export_state_contract`"
        ),
        "statuses": list(ALL_STATUSES),
        "labels": {s: STATUS_LABELS[s] for s in ALL_STATUSES},
        # 백엔드가 받는 검사 유형. 프론트 레지스트리와 일치해야 한다 —
        # 어긋나면 모달에서 고를 수 있는데 API가 422를 돌려준다.
        "exam_types": list(SUPPORTED_EXAM_TYPES),
        # 임상가 확정 이후 — 결과 열람·보고서 발행이 열리는 구간
        "confirmed_statuses": sorted(CONFIRMED_STATUSES),
        # 전수 전이표. allowed=false까지 명시해야 소비자가 규칙을 재구현하지 않는다.
        "transitions": [
            {"from": src, "to": dst, "allowed": can_transition(src, dst)}
            for src in ALL_STATUSES
            for dst in ALL_STATUSES
        ],
        # 사람이 읽기 쉬운 형태 — 검증에는 transitions를 쓴다.
        "next_statuses": {s: list(VALID_TRANSITIONS[s]) for s in ALL_STATUSES},
        # 플랫폼(마인드스코프) 사상표 — 회의 합의 전 초안.
        # 여기 두는 이유: 상태가 바뀌면 사상도 같이 검토돼야 하는데, 별도
        # 파일이면 한쪽만 고치고 지나갈 수 있다. 같은 diff에 뜨게 한다.
        "platform_mapping": build_mapping_contract(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="파일이 현재 상태 머신과 일치하는지 확인만 (CI용)",
    )
    args = parser.parse_args()

    contract = build_contract()
    rendered = json.dumps(contract, ensure_ascii=False, indent=2) + "\n"

    if args.check:
        if not CONTRACT_PATH.exists():
            print(f"❌ 계약 파일이 없다: {CONTRACT_PATH}", file=sys.stderr)
            print("   `uv run python -m scripts.export_state_contract` 실행 필요", file=sys.stderr)
            return 1
        if CONTRACT_PATH.read_text(encoding="utf-8") != rendered:
            print(f"❌ 계약 파일이 낡았다: {CONTRACT_PATH}", file=sys.stderr)
            print("   state_machine.py를 고쳤으면 계약도 갱신해야 한다", file=sys.stderr)
            return 1
        print(f"✅ 계약 파일이 최신이다 ({len(contract['transitions'])}쌍)")
        return 0

    CONTRACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONTRACT_PATH.write_text(rendered, encoding="utf-8")
    n = len(contract["statuses"])
    print(f"✅ {CONTRACT_PATH}")
    print(f"   상태 {n}종 · 전이 {n * n}쌍 (허용 {sum(t['allowed'] for t in contract['transitions'])})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
