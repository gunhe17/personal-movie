"""쌍반응 (2)는 세 값이다 — "안 봤다"와 "쌍 아님"은 다르다.

무엇을 막는 테스트인가
----------------------
`pair`는 `bool = False`였다. 그래서 **검토하지 않은 반응과 쌍이 아니라고
판단한 반응이 같은 값**이었다. `popular`가 같은 이유로 이미 3상태가 됐는데
(§13 E-2) `pair`만 남아 있었다(2026-08-26).

여기서 유독 값이 센 이유: (2)는 **자아중심성 지표 3r+(2)/R**에 직접 들어가고,
그 값이 다시 S-CON(자살지표)·DEPI로 흘러간다. 검토하지 않은 반응이
"쌍 아님"으로 집계되면 지표가 조용히 낮아진다 — 자살지표가 낮아지는 쪽이다.

AI 경로도 같이 막혔었다: AI 서버는 `coding.pair`를 보내는데 우리가 읽지
않았고(`RorschachScoringResult`에 필드 자체가 없었다), `_scoring_to_coding_dict`가
`"pair": False`로 굳혔다. **초안의 (2)는 AI가 무엇을 봤든 항상 "쌍 아님"이었다.**
"""
import pytest

from app.infrastructure.ai.base import RorschachScoringResult
from app.modules.examination.rorschach.schemas import RorschachCoding
from app.modules.examination.rorschach.scoring import (
    calculate_lower_section,
    calculate_structural_summary,
)
from app.modules.examination.rorschach.services import _scoring_to_coding_dict


def _coding(pair=None):
    return {
        "location": "W", "dq": "o", "determinants": ["F"], "fq": "o",
        "pair": pair, "contents": ["A"], "popular": None,
        "z_score": None, "special_scores": [],
    }


def _ego(codings):
    cards = [(i % 10) + 1 for i in range(len(codings))]
    summary = calculate_structural_summary(codings, cards)
    lower = calculate_lower_section(codings, cards, summary)
    return lower["selfPerception"]["3r+(2)/R"]


class TestSchemaDefault:
    def test_default_is_none_not_false(self):
        """기본값이 False면 저장하는 순간 '쌍 아님'으로 확정된다."""
        assert RorschachCoding().pair is None

    @pytest.mark.parametrize("v", [True, False, None])
    def test_all_three_values_accepted(self, v):
        assert RorschachCoding(pair=v).pair is v


class TestAggregationCountsTrueOnly:
    """집계는 True만 센다 — None과 False는 둘 다 쌍이 아니다."""

    def test_none_and_false_aggregate_the_same(self):
        assert _ego([_coding(None) for _ in range(14)]) == _ego(
            [_coding(False) for _ in range(14)]
        )

    def test_true_raises_egocentricity(self):
        """(2)가 자아중심성 지표에 실제로 들어간다 — 안 들어가면 이 테스트가 죽는다."""
        none_all = _ego([_coding(None) for _ in range(14)])
        half = _ego([_coding(True) for _ in range(7)] + [_coding(None) for _ in range(7)])
        assert half > none_all
        assert half == pytest.approx(7 / 14, abs=0.01)


class TestAiPathNoLongerHardcodesFalse:
    def test_ai_pair_is_carried_through(self):
        r = RorschachScoringResult(location="W", pair=True)
        assert _scoring_to_coding_dict(r)["pair"] is True, (
            "AI가 준 (2)가 버려졌다. 예전에는 여기서 False로 굳어, "
            "자아중심성 지표가 반사(Fr+rF)만으로 계산됐다."
        )

    def test_ai_without_pair_is_false_not_true(self):
        assert _scoring_to_coding_dict(RorschachScoringResult(location="W"))["pair"] is False
