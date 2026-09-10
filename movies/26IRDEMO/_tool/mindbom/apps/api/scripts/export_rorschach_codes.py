"""로르샤하 코딩 부호를 언어 중립 JSON으로 내보낸다.

왜 필요한가
-----------
부호의 정본은 백엔드다 — scoring.py가 읽는 부호가 곧 "이 시스템이 아는
부호"이기 때문이다. 그런데 임상가가 실제로 고르는 목록은 프론트 UI에 있다.
두 언어가 그 목록을 각자 손으로 적으면 어긋나도 아무도 모른다.

실제로 어긋나 있었다(2026-08 발견). UI에 없는 부호는 입력이 불가능하므로
채점이 항상 0을 읽었고, ISO Index·COP·AG·MOR·PER·Fd·CP가 조용히 죽어 있었다.
에러도 경고도 없이 임상 결과만 틀렸다.

exam-state.json과 같은 방식이다. 계약을 데이터로 고정하고 양쪽 테스트가
같은 파일을 읽는다 — 소스 파싱은 리팩터링에 취약하지만 데이터는 아니다.

쓰는 법
-------
    uv run python -m scripts.export_rorschach_codes          # 파일 갱신
    uv run python -m scripts.export_rorschach_codes --check  # 최신인지 확인만

--check는 CI용이다. coding_codes.py를 고치고 이 파일을 안 만들면 실패한다.
"""
import argparse
import json
import sys
from pathlib import Path

from app.modules.examination.rorschach.coding_codes import (
    CODING_OPTIONS,
    LOCATION_RE,
    POPULAR_RESPONSES,
    SCORED_GROUPS,
    z_values_by_card,
)

# apps/api/scripts/ → 리포지토리 루트
CONTRACT_PATH = (
    Path(__file__).resolve().parents[3] / "contracts" / "rorschach-coding.json"
)


def build_contract() -> dict:
    return {
        "_comment": (
            "자동 생성 — 직접 고치지 말 것. "
            "정본은 apps/api/app/modules/examination/rorschach/coding_codes.py, "
            "갱신은 `uv run python -m scripts.export_rorschach_codes`"
        ),
        # 그룹 이름은 RorschachCoding 스키마의 필드명과 같다.
        # 프론트 CODING_OPTIONS의 키도 이것을 그대로 쓴다.
        "groups": {g: list(codes) for g, codes in CODING_OPTIONS.items()},
        # 채점(scoring.py)이 부호를 이름으로 읽는 그룹.
        # 이 그룹들은 UI가 목록을 좁히면 지표가 조용히 죽는다.
        "scored_groups": list(SCORED_GROUPS),
        # 평범반응 표 (워크북 〈표 5-2〉 89쪽).
        #
        # P는 **표의 함수**이지 임상가의 인상이 아니다(§13 E-2). 화면이
        # "이 자리가 평범반응 자리입니다"를 말하려면 표를 알아야 하는데,
        # 프론트가 그 표를 따로 적으면 부호 목록과 똑같은 방식으로 어긋난다.
        #
        # ⚠️ 이 표로 P를 **자동 판정하지 않는다.** 기준에 무엇으로 봤는지가
        # 걸려 있어 영역이 맞아도 내용이 다르면 P가 아니다. 표가 답하는 것은
        # "이 카드의 이 영역이 평범반응 자리인가"까지다.
        # 조직활동 Z값 — 카드별 ZW/ZA/ZD/ZS (워크북 〈표 6-1〉 94쪽).
        #
        # 값이 **카드마다 다르다**(카드 I의 ZW=1.0, IX의 ZW=5.5). 화면이 부호만
        # 보여주면 임상가는 무엇을 고르는지 알 수 없고, "두 기준을 함께 만족하면
        # 더 높은 값"이라는 규칙도 적용할 수 없다.
        #
        # 키는 문자열이다 — JSON 객체 키는 문자열만 된다.
        "z_values": {
            str(card): vals for card, vals in z_values_by_card().items()
        },
        # 영역 부호의 형태 — `W` / `DS6` / `Dd99`.
        #
        # 이것만 부호 목록이 아니라 **정규식**인 이유: 영역은 범주(W/D/Dd)에
        # 공백(S)과 번호가 붙는 조합이라 열거가 안 된다(Dd99까지 있다).
        # 그래서 프론트 `LocationPicker`가 같은 정규식을 손으로 적고 있었고,
        # 어긋나면 **서버가 받아준 값을 화면이 못 읽어 칸이 비어 보인다** —
        # 임상가에게는 "부호가 사라졌다"로 보이고, 다시 저장하면 진짜 사라진다.
        # 파이썬 문법(`(?P<...>)` 같은 것)을 쓰지 않아 JS `RegExp`가 그대로 받는다.
        "location_pattern": LOCATION_RE.pattern,
        "popular_responses": [
            {
                "card_no": p["card_no"],
                "locations": list(p["locations"]),
                "content": p["content"],
                "criteria": p["criteria"],
            }
            for p in POPULAR_RESPONSES
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="파일이 현재 부호 표와 일치하는지 확인만 (CI용)",
    )
    args = parser.parse_args()

    contract = build_contract()
    rendered = json.dumps(contract, ensure_ascii=False, indent=2) + "\n"

    if args.check:
        if not CONTRACT_PATH.exists():
            print(f"❌ 계약 파일이 없다: {CONTRACT_PATH}", file=sys.stderr)
            print("   `uv run python -m scripts.export_rorschach_codes` 실행 필요", file=sys.stderr)
            return 1
        if CONTRACT_PATH.read_text(encoding="utf-8") != rendered:
            print(f"❌ 계약 파일이 낡았다: {CONTRACT_PATH}", file=sys.stderr)
            print("   coding_codes.py를 고쳤으면 계약도 갱신해야 한다", file=sys.stderr)
            return 1
        total = sum(len(v) for v in contract["groups"].values())
        print(f"✅ 계약 파일이 최신이다 (부호 {total}개)")
        return 0

    CONTRACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONTRACT_PATH.write_text(rendered, encoding="utf-8")
    print(f"✅ {CONTRACT_PATH}")
    for g, codes in contract["groups"].items():
        mark = "*" if g in contract["scored_groups"] else " "
        print(f"  {mark} {g:14} {len(codes):2}개")
    print("   (* = 채점이 읽는 그룹)")
    print(f"    평범반응 {len(contract['popular_responses'])}개")
    print(f"    Z값 카드 {len(contract['z_values'])}장")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
