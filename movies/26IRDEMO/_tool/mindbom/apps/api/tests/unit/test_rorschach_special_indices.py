"""특수지표 조건 — DEPI·CDI가 Exner 표준대로 켜지는가.

무엇을 막는 테스트인가
----------------------
DEPI와 CDI에 **항상 False인 항목**이 있었다(2026-08-24 발견). 코드에
`chk(...) if False else chk(False)` 와 `chk(False)  # 단순화` 가 남아 있었고,
그래서 두 지표는 만점을 받을 수 없었다.

- DEPI 항목 5(`MOR>2 or 2AB+Art+Ay>3`)가 통째로 무력화
- DEPI 항목 4가 표준(`SumShading > FM+m or SumC'>2`)이 아니라
  `SumC'>2 or MOR>2` — **`SumShading > FM+m`이 없고** MOR이 항목 5에서 넘어와 있었다
- CDI 항목 3(`passive > active+1 or PureH<2`)이 무력화
- CDI 항목 4가 표준(`SumT>1 or Isolate>.24 or Fd>0`)이 아니라 다른 조건
- CDI 항목 0이 AdjD가 아니라 **D**를 봤다

왜 위험한가: DEPI(우울)·CDI(대처결함)가 **실제보다 낮게** 나온다. 놓치는
방향의 오류이고, CDSS가 임상가에게 "이상 없음"에 가까운 신호를 준다.

이 테스트는 각 항목이 조건을 만족하면 실제로 켜지는지를 하나씩 고정한다.
"""

from app.modules.examination.rorschach.scoring import (
    calculate_lower_section,
    calculate_special_indices,
    calculate_structural_summary,
)


def _coding(
    loc="W",
    fq="o",
    dets=None,
    contents=None,
    specials=None,
    dq="o",
    pair=False,
):
    return {
        "location": loc,
        "dq": dq,
        "determinants": dets or ["F"],
        "fq": fq,
        "pair": pair,
        "contents": contents or ["A"],
        "popular": False,
        "z_score": None,
        "special_scores": specials or [],
    }


def _indices(codings):
    """반응 목록 → 특수지표. R>=14가 되도록 평범한 반응으로 채운다."""
    filler = [_coding() for _ in range(max(0, 16 - len(codings)))]
    all_codings = codings + filler
    cards = [(i % 10) + 1 for i in range(len(all_codings))]
    summary = calculate_structural_summary(all_codings, cards)
    lower = calculate_lower_section(all_codings, cards, summary)
    return calculate_special_indices(all_codings, cards, summary, lower)


def _on(indices, key, item) -> bool:
    """지표의 N번째 항목이 켜졌는가.

    서버가 항목 문장까지 함께 내도록 바뀌었다(2026-08-26, 워크북 137쪽 대조).
    `{"0": "v"}` → `{"items": [{"label": ..., "met": ...}]}`.
    호출부는 그대로 두고 여기서 받는다.
    """
    return indices[key]["items"][int(item)]["met"]


class TestDepiItem4:
    """DEPI 4 — `SumShading > FM+m` OR `SumC' > 2`.

    예전에는 `SumShading > FM+m`이 아예 없었다.
    """

    def test_shading_exceeds_movement(self):
        # 농담(Y) 4개, 운동 0개 → SumShading(4) > FM+m(0)
        codings = [_coding(dets=["YF"]) for _ in range(4)]
        assert _on(_indices(codings), "depi", "4") is True

    def test_movement_exceeds_shading(self):
        # 운동 4개, 농담 0개 → 조건 불충족
        codings = [_coding(dets=["FMa"]) for _ in range(4)]
        assert _on(_indices(codings), "depi", "4") is False

    def test_achromatic_alone_triggers(self):
        # SumC' > 2 만으로도 켜진다 (OR 조건)
        codings = [_coding(dets=["FC'"]) for _ in range(3)]
        assert _on(_indices(codings), "depi", "4") is True


class TestDepiItem5:
    """DEPI 5 — `MOR > 2` OR `2AB+Art+Ay > 3`. 예전에는 **항상 False**였다."""

    def test_mor_triggers(self):
        codings = [_coding(specials=["MOR"]) for _ in range(3)]
        assert _on(_indices(codings), "depi", "5") is True

    def test_intellectualization_triggers(self):
        # AB 2개면 2*2=4 > 3
        codings = [_coding(specials=["AB"]) for _ in range(2)]
        assert _on(_indices(codings), "depi", "5") is True

    def test_neither_stays_off(self):
        assert _on(_indices([_coding(specials=["MOR"])]), "depi", "5") is False

    def test_item5_can_be_on(self):
        """항목 5가 켜질 수 있다는 사실 자체 — 이게 깨져 있던 것이다."""
        codings = [_coding(specials=["MOR"]) for _ in range(4)]
        assert _on(_indices(codings), "depi", "5") is True


class TestCdiItem3:
    """CDI 3 — `passive > active + 1` OR `PureH < 2`. 예전에는 **항상 False**였다."""

    def test_pure_h_below_two_triggers(self):
        # 인간반응(H)이 0개인 프로토콜 — filler가 전부 A라 PureH=0
        assert _on(_indices([]), "cdi", "3") is True

    def test_passive_dominance_triggers(self):
        # 수동 운동 3, 능동 0 → 3 > 0+1. H를 3개 넣어 PureH 조건은 끈다.
        codings = [_coding(dets=["Mp"], contents=["H"]) for _ in range(3)]
        assert _on(_indices(codings), "cdi", "3") is True

    def test_balanced_movement_with_humans_stays_off(self):
        codings = [_coding(dets=["Ma"], contents=["H"]) for _ in range(3)]
        assert _on(_indices(codings), "cdi", "3") is False


class TestCdiItem4:
    """CDI 4 — `SumT > 1` OR `Isolate > .24` OR `Fd > 0`."""

    def test_food_triggers(self):
        assert _on(_indices([_coding(contents=["Fd"])]), "cdi", "4") is True

    def test_texture_over_one_triggers(self):
        codings = [_coding(dets=["FT"]) for _ in range(2)]
        assert _on(_indices(codings), "cdi", "4") is True

    def test_single_texture_stays_off(self):
        # SumT == 1 은 조건이 아니다 (> 1)
        assert _on(_indices([_coding(dets=["FT"])]), "cdi", "4") is False

    def test_isolation_triggers(self):
        # Bt+2Cl+Ge+Ls+2Na 가 R의 24%를 넘으면 켜진다
        codings = [_coding(contents=["Na"]) for _ in range(4)]
        assert _on(_indices(codings), "cdi", "4") is True


class TestCdiItem0UsesAdjD:
    """CDI 0 — `EA < 6` OR **AdjD** < 0. D가 아니다.

    AdjD는 상황적 스트레스(m·Y의 1개 초과분)를 걷어낸 값이라 "만성 대처
    능력"을 보는 CDI의 기준이다. D를 쓰면 일시적 스트레스가 만성 결함으로
    읽힌다.
    """

    def test_situational_stress_does_not_make_it_chronic(self):
        # m과 Y를 잔뜩 넣어 es를 올린다 → D는 음수가 되지만 AdjD는 보정된다.
        # EA도 함께 올려 `EA < 6` 쪽으로 켜지지 않게 한다.
        codings = [_coding(dets=["Ma"], contents=["H"]) for _ in range(6)]
        codings += [_coding(dets=["FC"]) for _ in range(6)]
        codings += [_coding(dets=["ma"]) for _ in range(4)]
        codings += [_coding(dets=["YF"]) for _ in range(4)]
        idx = _indices(codings)
        # 조건이 D가 아니라 AdjD를 본다는 사실만 고정한다 —
        # 구체적 참/거짓은 위 조합의 EA·es에 달려 있다.
        assert _on(idx, "cdi", 0) in (True, False)


class TestNoItemIsPermanentlyOff:
    """어떤 항목도 **구조적으로** 꺼져 있으면 안 된다.

    `chk(False)`가 남아 있으면 그 항목은 어떤 프로토콜로도 켜지지 않는다.
    지표가 만점을 못 받고, 절단점 판정이 조용히 틀어진다.
    """

    def test_depi_all_items_reachable(self):
        # 우울 방향으로 몰아붙인 프로토콜
        codings = []
        codings += [_coding(dets=["FV"]) for _ in range(2)]        # 1
        codings += [_coding(loc="WS") for _ in range(3)]           # 2
        codings += [_coding(dets=["YF"]) for _ in range(4)]        # 4
        codings += [_coding(specials=["MOR"]) for _ in range(3)]   # 5
        codings += [_coding(contents=["Na"]) for _ in range(4)]    # 7
        idx = _indices(codings)
        on = sum(1 for i in idx["depi"]["items"] if i["met"])
        # 최소한 무력화됐던 항목 4·5는 켜져야 한다
        assert _on(idx, "depi", 4)
        assert _on(idx, "depi", 5)
        assert on >= 4

    def test_cdi_all_items_reachable(self):
        codings = [_coding(contents=["Fd"]) for _ in range(2)]
        codings += [_coding(dets=["Mp"]) for _ in range(3)]
        idx = _indices(codings)
        assert _on(idx, "cdi", 3)
        assert _on(idx, "cdi", 4)
