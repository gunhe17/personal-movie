"""특수지표 6개 — 워크북 〈Constellation Worksheet〉와 항목·판정이 같은가.

무엇을 막는 테스트인가
----------------------
**출처: 『로르샤하 종합체계 워크북』(Exner) 137쪽.**
2026-08-26에 6개 지표를 전수 대조했고, HVI·OBS가 크게 어긋나 있었다.

HVI — 원전은 8항목이다:
    (1) FT+TF+T=0 [필수] (2) Zf>12 (3) Zd>+3.5 (4) S>3
    (5) H+(H)+Hd+(Hd)>6 (6) (H)+(A)+(Hd)+(Ad)>3 (7) H+A:Hd+Ad<4:1 (8) Cg>3
그런데 `Zf>12`·`Zd>+3.5`·`S>3`가 **아예 없었고** 원전에 없는 `Cn>0`·`H+(H)>6`이
그 자리를 차지했다. 화면 라벨은 원전을 따르고 있었으므로 인덱스가 밀려
**"Zf > 12 ✔"가 Zf를 보지 않는 조건으로 켜졌다.**

판정도 달랐다. 원전은 "1번을 만족시키고 아래 7개 중 최소한 4개"인데
화면·PDF가 각자 `체크 수 >= 4`로 판정해 **(1) 없이도 양성**이 됐다.
OBS는 더하다 — 원전은 4개 복합 규칙 중 하나인데 `>= 1`이었다.

그래서 이제 **판정과 항목 문장을 백엔드가 함께 낸다.** 조건·문장·판정이
갈라져 있으면 어긋나도 아무 데서도 터지지 않는다는 것이 이 사건의 교훈이다.
"""
import pytest

from app.modules.examination.rorschach.scoring import (
    calculate_lower_section,
    calculate_special_indices,
    calculate_structural_summary,
)


def _coding(loc="W", fq="o", dets=None, contents=None, specials=None, dq="o"):
    return {
        "location": loc, "dq": dq, "determinants": dets or ["F"], "fq": fq,
        "pair": None, "contents": contents or ["A"], "popular": None,
        "z_score": None, "special_scores": specials or [],
    }


def _indices(codings):
    filler = [_coding() for _ in range(max(0, 16 - len(codings)))]
    all_codings = codings + filler
    cards = [(i % 10) + 1 for i in range(len(all_codings))]
    summary = calculate_structural_summary(all_codings, cards)
    lower = calculate_lower_section(all_codings, cards, summary)
    return calculate_special_indices(all_codings, cards, summary, lower)


def _labels(idx, key):
    return [i["label"] for i in idx[key]["items"]]


BASE = _indices([])


class TestShapeIsSelfDescribing:
    """항목 문장·판정 규칙·양성 여부가 **한 자리에서** 나온다."""

    @pytest.mark.parametrize(
        "key", ["sConstellation", "depi", "cdi", "pti", "hvi", "obs"]
    )
    def test_every_index_carries_its_own_labels_and_verdict(self, key):
        idx = BASE[key]
        assert idx["label"], "지표 이름이 없다 — 화면이 또 손으로 적게 된다"
        assert idx["rule"], "판정 규칙 문장이 없다"
        assert idx["items"], "항목이 없다"
        assert isinstance(idx["positive"], bool), "판정을 소비자에게 미루고 있다"
        for item in idx["items"]:
            assert item["label"], "항목 문장이 비어 있다"
            assert isinstance(item["met"], bool)


class TestWorkbookItems:
    """항목 목록이 워크북 137쪽과 같은가 — **순서까지** 본다."""

    def test_hvi_items(self):
        assert _labels(BASE, "hvi") == [
            "(필수) FT+TF+T = 0",
            "Zf > 12",
            "Zd > +3.5",
            "S > 3",
            "H+(H)+Hd+(Hd) > 6",
            "(H)+(A)+(Hd)+(Ad) > 3",
            "H+A : Hd+Ad < 4:1",
            "Cg > 3",
        ]

    def test_obs_items(self):
        labels = _labels(BASE, "obs")
        assert labels[:5] == [
            "(1) Dd > 3",
            "(2) Zf > 12",
            "(3) Zd > +3.0",
            "(4) Populars > 7",
            "(5) FQ+ > 1",
        ]
        assert labels[5:] == [
            "(1)~(5) 모두 해당",
            "(1)~(4) 중 2개 이상 그리고 FQ+ > 3",
            "(1)~(5) 중 3개 이상 그리고 X+% > .89",
            "FQ+ > 3 그리고 X+% > .89",
        ]

    def test_scon_has_twelve_items(self):
        assert len(_labels(BASE, "sConstellation")) == 12

    def test_hvi_and_obs_use_different_zd_thresholds(self):
        """HVI는 +3.5, OBS는 +3.0이다 — 한쪽으로 통일하면 안 된다."""
        assert "Zd > +3.5" in _labels(BASE, "hvi")
        assert "(3) Zd > +3.0" in _labels(BASE, "obs")


class TestHviVerdictNeedsItemOne:
    """"1번을 만족시키고 아래 7개 중 최소한 4개" — 단순 개수가 아니다."""

    def _hvi(self, codings):
        return _indices(codings)["hvi"]

    def test_item_one_missing_stays_negative(self):
        # 재질(T)이 있으면 (1)이 꺼진다. 나머지를 아무리 켜도 음성이어야 한다.
        codings = [_coding(dets=["FT"])]
        codings += [_coding(loc="WS", contents=["Hd"]) for _ in range(6)]
        codings += [_coding(contents=["(H)"]) for _ in range(4)]
        hvi = self._hvi(codings)
        assert hvi["items"][0]["met"] is False
        assert hvi["positive"] is False, (
            "(1)이 꺼졌는데 양성이다 — 개수만 세고 있다"
        )

    def test_item_one_alone_is_not_enough(self):
        """T가 0이기만 하면 대부분의 프로토콜이 (1)을 만족한다."""
        hvi = self._hvi([])
        assert hvi["items"][0]["met"] is True
        assert hvi["positive"] is False


class TestObsVerdictUsesCompositeRules:
    """원전은 "한 가지 이상 해당될 경우 체크"라는 4개 복합 규칙으로 판정한다."""

    def test_single_base_item_does_not_trigger(self):
        # Dd만 4개 — 기본 항목 (1)만 켜진다. 예전 `>= 1` 판정이면 양성이었다.
        idx = _indices([_coding(loc="Dd") for _ in range(4)])["obs"]
        assert idx["items"][0]["met"] is True
        assert idx["positive"] is False, (
            "기본 항목 하나로 양성이 됐다 — 복합 규칙을 안 보고 있다"
        )

    def test_verdict_follows_the_rule_rows(self):
        """양성은 **판정 규칙 4개 중 하나가 켜졌을 때만** 참이다."""
        for codings in (
            [],
            [_coding(loc="Dd") for _ in range(4)],
            [_coding(fq="+") for _ in range(5)],
        ):
            idx = _indices(codings)["obs"]
            assert idx["positive"] == any(i["met"] for i in idx["items"][5:])


class TestSealedProtocolKeepsTheSameShape:
    """봉인(R<14)이어도 모양이 같아야 한다 — 읽는 쪽이 분기를 더 갖지 않게."""

    def test_sealed_has_no_items_and_is_negative(self):
        cards = [1, 2, 3]
        codings = [_coding() for _ in range(3)]
        summary = calculate_structural_summary(codings, cards)
        lower = calculate_lower_section(codings, cards, summary)
        idx = calculate_special_indices(codings, cards, summary, lower)
        for key in ("sConstellation", "depi", "cdi", "pti", "hvi", "obs"):
            assert idx[key]["items"] == []
            assert idx[key]["positive"] is False
            assert idx[key]["label"]
            assert "산출하지 않음" in idx[key]["rule"]
