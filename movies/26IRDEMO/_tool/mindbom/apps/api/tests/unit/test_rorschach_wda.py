"""WDA%는 XA%와 다른 값이다 — 분모가 다르다.

무엇을 막는 테스트인가
----------------------
**출처: 『로르샤하 종합체계 워크북』(Exner) 133쪽 〈중재영역〉 1·2번.**

    XA%  = (FQ가 +, o, u인 반응의 합) / R
    WDA% = (W+D반응 중 FQ가 +, o, u인 반응의 합) / (W+D 반응의 합)

코드는 `wda_pct = xa_pct`였다. 주석은 "단순화 — W+D vs Dd 분류 필요"라고
적혀 있었지만 **그 분류는 이미 있었다**(`_split_location`).

왜 그냥 두면 안 되나:
- 화면·PDF가 두 값을 **독립된 두 칸**으로 보여준다. 임상가는 서로 다른
  두 지표를 읽는 줄 안다.
- **PTI 항목 1이 둘을 따로 본다**(`XA% < .70 그리고 WDA% < .75`).
  같은 값을 넣으면 한쪽 조건만 두 번 확인하는 셈이라, WDA%가 실제로는
  기준을 넘는 프로토콜에서도 그 항목이 켜진다 — 지각·사고 지표가
  실제보다 높게 나가는 방향이다.

원전 예시 자체가 둘이 다르다는 것을 보여준다: 같은 프로토콜에서
XA% = 12/17 = 0.71, WDA% = 12/15 = 0.80.
"""
import pytest

from app.modules.examination.rorschach.scoring import (
    _wda_pct,
    calculate_lower_section,
    calculate_special_indices,
    calculate_structural_summary,
)


def _coding(loc="W", fq="o"):
    return {
        "location": loc, "dq": "o", "determinants": ["F"], "fq": fq,
        "pair": None, "contents": ["A"], "popular": None,
        "z_score": None, "special_scores": [],
    }


def _mediation(codings):
    cards = [(i % 10) + 1 for i in range(len(codings))]
    summary = calculate_structural_summary(codings, cards)
    lower = calculate_lower_section(codings, cards, summary)
    return lower["cognitiveMediation"]


class TestWorkbookExample:
    """워크북 133쪽 예시를 그대로 세운다: R=17, W·D 반응 15개 중 12개가 o/u."""

    def _protocol(self):
        # W·D 반응 15개 — 그중 12개가 o/u, 3개가 -
        codings = [_coding("W", "o") for _ in range(9)]
        codings += [_coding("D1", "u") for _ in range(3)]
        codings += [_coding("D2", "-") for _ in range(3)]
        # Dd 반응 2개 — **WDA% 분모에서 빠진다.** 둘 다 -로 둔다.
        codings += [_coding("Dd99", "-") for _ in range(2)]
        return codings

    def test_xa_counts_every_response(self):
        assert self._mediation_xa() == 0.71   # 12 / 17

    def _mediation_xa(self):
        return _mediation(self._protocol())["XA%"]

    def test_wda_counts_only_w_and_d(self):
        assert _mediation(self._protocol())["WDA%"] == 0.8   # 12 / 15

    def test_the_two_are_not_the_same(self):
        m = _mediation(self._protocol())
        assert m["XA%"] != m["WDA%"], (
            "WDA%가 XA%와 같다 — 분모에서 Dd를 안 걷어내고 있다"
        )


class TestDdIsExcludedFromDenominator:
    def test_dd_failures_do_not_lower_wda(self):
        """Dd에서만 형태가 무너진 프로토콜 — WDA%는 온전해야 한다."""
        codings = [_coding("W", "o") for _ in range(10)]
        codings += [_coding("Dd21", "-") for _ in range(6)]
        m = _mediation(codings)
        assert m["WDA%"] == 1.0
        assert m["XA%"] == 0.62   # 10 / 16 = 0.625 → 파이썬 round는 0.62

    @pytest.mark.parametrize("loc", ["WS", "DS5", "D1"])
    def test_space_responses_still_count_as_w_or_d(self, loc):
        """WS·DS는 W·D 영역을 쓴 반응이다 — 분모에 든다."""
        assert _wda_pct([_coding(loc, "o")]) == 1.0

    @pytest.mark.parametrize("loc", ["Dd21", "DdS26", "Dds30", "Dd99"])
    def test_dd_variants_are_excluded(self, loc):
        assert _wda_pct([_coding(loc, "o")]) is None


class TestUndefinedWhenNoCommonAreas:
    def test_all_dd_is_none_not_zero(self):
        """0을 내면 "그 영역들을 다 틀리게 봤다"는 뜻이라 정반대다."""
        assert _wda_pct([_coding("Dd99", "o") for _ in range(14)]) is None

    def test_cluster_shows_dash_not_blank(self):
        m = _mediation([_coding("Dd99", "o") for _ in range(14)])
        assert m["WDA%"] == "-"

    def test_pti_item_does_not_fire_on_undefined_wda(self):
        """모르는 값을 "작다"로 볼 수 없다 — PTI 항목 1이 켜지면 안 된다."""
        codings = [_coding("Dd99", "-") for _ in range(14)]   # XA%는 0.0
        cards = [(i % 10) + 1 for i in range(len(codings))]
        summary = calculate_structural_summary(codings, cards)
        lower = calculate_lower_section(codings, cards, summary)
        pti = calculate_special_indices(codings, cards, summary, lower)["pti"]
        assert pti["items"][0]["met"] is False
