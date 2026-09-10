"""Lambda — 모든 반응이 순수 형태일 때 0.0이 아니라 "정의되지 않음"이다.

무엇을 막는 테스트인가
----------------------
    L = F(순수 형태반응의 수) / (R−F)
    출처: 『로르샤하 종합체계 워크북』(Exner) 128쪽 〈구조적 요약: 하단부〉
          핵심영역 1번. 같은 쪽 예시 R=17, F=6 → 0.55로 대조했다.

R = F이면 분모가 0이라 정의되지 않는다. 예전 코드는 그 경우 `0.0`을 냈다.
**0.0은 "순수 형태반응이 하나도 없다"는 뜻이라 정반대 소견이다.** 실제로는
형태 편중이 극단에 있는 상태이고, 그건 빈 값이 아니라 강한 임상 신호다.

Lambda는 "심리적 자원의 경제적 사용"과 관련된다(워크북 128쪽). 값이 클수록
형태에 기댄다 — 0에 가까울수록 반대다. 두 끝을 맞바꿔 내보내고 있었다.
"""
import pytest

from app.modules.examination.rorschach.scoring import (
    LAMBDA_UNDEFINED,
    calculate_lower_section,
    calculate_structural_summary,
)


def _coding(dets=None):
    return {
        "location": "W", "dq": "o", "determinants": dets or ["F"],
        "fq": "o", "pair": False, "contents": ["A"],
        "popular": False, "z_score": None, "special_scores": [],
    }


def _summary(codings):
    cards = [(i % 10) + 1 for i in range(len(codings))]
    return calculate_structural_summary(codings, cards), cards


class TestWorkbookExample:
    def test_matches_workbook_128p(self):
        """R=17, F=6 → 6/11 = 0.55 (워크북 128쪽 예시)."""
        codings = [_coding() for _ in range(6)] + [_coding(["Ma"]) for _ in range(11)]
        s, _ = _summary(codings)
        assert s["R"] == 17
        assert s["Lambda"] == 0.55


class TestPureFormIsPerResponse:
    """"순수 형태반응의 수"는 반응 단위다 — 부호 'F'의 출현 횟수가 아니다."""

    def test_f_inside_blend_is_not_pure_form(self):
        # Exner에서 F는 언제나 단독이지만, 옛 목업이 ["M","F"] 같은 코딩을
        # 만들어 DB에 남겼다. 그 반응까지 세면 Lambda가 부푼다.
        codings = [_coding(["Ma", "F"]) for _ in range(14)]
        s, _ = _summary(codings)
        assert s["Lambda"] == 0.0, "혼합 안의 F가 순수 형태반응으로 세어졌다"

    def test_mixed_protocol(self):
        codings = (
            [_coding() for _ in range(4)]          # 순수 F 4
            + [_coding(["Ma", "F"]) for _ in range(2)]  # 혼합 — 세면 안 된다
            + [_coding(["Ma"]) for _ in range(8)]
        )
        s, _ = _summary(codings)
        assert s["R"] == 14
        assert s["Lambda"] == 0.4       # 4 / (14-4)


class TestUndefinedWhenAllPureForm:
    def test_all_pure_form_is_none_not_zero(self):
        s, _ = _summary([_coding() for _ in range(14)])
        assert s["Lambda"] is None, (
            "R=F인데 Lambda가 숫자로 나왔다. 0.0은 '순수 형태가 없다'는 "
            "정반대 소견이라 임상가를 반대 방향으로 민다."
        )

    def test_zero_still_means_no_pure_form(self):
        """진짜 0.0은 남아 있어야 한다 — 순수 형태반응이 하나도 없을 때."""
        s, _ = _summary([_coding(["Ma"]) for _ in range(14)])
        assert s["Lambda"] == 0.0

    def test_cluster_shows_infinity_not_blank(self):
        """하단 클러스터는 표시용이다 — 빈 칸이면 '계산 실패'로 읽힌다."""
        codings = [_coding() for _ in range(14)]
        summary, cards = _summary(codings)
        lower = calculate_lower_section(codings, cards, summary)
        assert lower["core"]["Lambda"] == LAMBDA_UNDEFINED

    @pytest.mark.parametrize("pure,other,expected", [
        (14, 0, None),      # 전부 순수 형태 → 정의 불가
        (13, 1, 13.0),      # 하나만 아니어도 값이 나온다
        (7, 7, 1.0),
        (0, 14, 0.0),
    ])
    def test_boundary(self, pure, other, expected):
        codings = [_coding() for _ in range(pure)] + [_coding(["Ma"]) for _ in range(other)]
        s, _ = _summary(codings)
        assert s["Lambda"] == expected
