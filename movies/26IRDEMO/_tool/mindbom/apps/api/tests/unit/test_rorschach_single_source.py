"""구조적 요약이 **인쇄한 값**으로 특수지표를 판정한다 — 두 벌로 세지 않는다.

무엇을 막는 테스트인가
----------------------
`calculate_lower_section`(표시)과 `calculate_special_indices`(판정)이 같은 값을
**각각** 계산하고 있었다. 값이 같으면 문제가 없어 보이지만, `3r+(2)/R`은
반올림 자리에서 실제로 갈렸다:

    표시: round((3×(Fr+rF) + (2)) / R, 2)
    판정:       (3×(Fr+rF) + (2)) / R          ← 원값

그래서 화면에 `0.44`가 찍혀 있는데 `3r+(2)/R > .44` 항목이 켤 수 있었다.
임상가는 구조적 요약을 보고 워크시트 항목을 되짚는데 **되짚어지지 않는다.**
그리고 두 문서 각각은 멀쩡해 보인다 — 어긋났다는 사실이 아무 데서도 안 터진다.

**원전이 정한다.** 워크북 125쪽 구조적 요약은 `3r+(2)/R = 0.35`처럼 소수
2자리로 인쇄하고, 137쪽 〈Constellation Worksheet〉는 그 값을 그대로 옮겨 본다 —
항목 옆에 값을 다시 적는 칸이 없다(`Sum PTI` 한 칸을 빼면 전부 체크박스다).
**판정 입력은 인쇄된 숫자다.** 그러니 반올림한 값이 정본이다.

같은 성격으로 모은 것: `Zd`, `SumShading`, `Pure C`, 인지적 특수점수 목록.
"""
from app.modules.examination.rorschach.scoring import (
    _COGNITIVE_SPECIAL_WEIGHTS,
    _LEVEL2_SPECIALS,
    calculate_lower_section,
    calculate_special_indices,
    calculate_structural_summary,
)


def _coding(loc="W", fq="o", dets=None, contents=None, specials=None,
            dq="o", pair=None):
    return {
        "location": loc, "dq": dq, "determinants": dets or ["F"], "fq": fq,
        "pair": pair, "contents": contents or ["A"], "popular": None,
        "z_score": None, "special_scores": specials or [],
    }


def _run(codings):
    cards = [(i % 10) + 1 for i in range(len(codings))]
    summary = calculate_structural_summary(codings, cards)
    lower = calculate_lower_section(codings, cards, summary)
    indices = calculate_special_indices(codings, cards, summary, lower)
    return summary, lower, indices


def _item(indices, key, needle):
    """지표의 항목 하나를 문장으로 찾는다 — 인덱스로 집지 않는다(§2의 교훈)."""
    for it in indices[key]["items"]:
        if needle in it["label"]:
            return it
    raise AssertionError(f"{key}에 '{needle}' 항목이 없다: {_all(indices, key)}")


def _all(indices, key):
    return [i["label"] for i in indices[key]["items"]]


def _egocentricity_boundary():
    """R=27, (2)=12, Fr+rF=0 → 12/27 = 0.4444… → **인쇄값 0.44**.

    경계 바로 위의 원값과 경계와 같은 인쇄값이 갈리는 자리다.
    `.44`를 초과하는지 묻는 항목이 S-CON에 하나, DEPI에 하나 있다.
    """
    return [_coding(pair=True) for _ in range(12)] + [_coding() for _ in range(15)]


class TestEgocentricityRounding:
    def test_인쇄값은_소수_2자리다(self):
        _, lower, _ = _run(_egocentricity_boundary())
        assert lower["selfPerception"]["3r+(2)/R"] == 0.44

    def test_판정은_인쇄값을_본다_옛_원값이면_켜졌을_항목이다(self):
        """원값 0.4444…는 `.44`를 넘지만 인쇄값 0.44는 안 넘는다.

        이 두 항목이 **꺼져 있어야** 화면의 `0.44`와 앞뒤가 맞는다.
        옛 동작(원값 판정)으로 되돌리면 둘 다 켜지면서 이 테스트가 죽는다.
        """
        _, _, indices = _run(_egocentricity_boundary())
        assert _item(indices, "sConstellation", "3r+(2)/R")["met"] is False
        assert _item(indices, "depi", "3r+(2)/R")["met"] is False

    def test_원전_125쪽_예시(self):
        """R=17, Fr+rF=1, (2)=3 → 6/17 = 0.3529… → 인쇄값 **0.35**.

        워크북 125쪽 구조적 요약에 그렇게 적혀 있다. 같은 프로토콜의 137쪽
        워크시트에서 `3r+(2)/R < .31 or > .44`(S-CON)는 체크돼 있지 않다 —
        0.35는 두 경계 사이다.
        """
        codings = (
            [_coding(dets=["Fr"])]
            + [_coding(pair=True) for _ in range(3)]
            + [_coding() for _ in range(13)]
        )
        _, lower, indices = _run(codings)
        assert lower["selfPerception"]["3r+(2)/R"] == 0.35
        assert _item(indices, "sConstellation", "3r+(2)/R")["met"] is False


class TestSameValueTwice:
    """표시와 판정이 **같은 계산**을 봐야 한다."""

    def test_Zd는_한_번만_계산된다(self):
        codings = [_coding(loc="W", dq="+") for _ in range(16)]
        _, lower, indices = _run(codings)
        zd = lower["informationProcessing"]["Zd"]
        # HVI (3)·OBS (3)·S-CON이 모두 이 값을 본다. 문장에 부호가 박혀 있으니
        # 항목이 존재하는지까지 함께 고정한다.
        assert isinstance(zd, float)
        assert _item(indices, "hvi", "Zd")
        assert _item(indices, "obs", "Zd")
        assert _item(indices, "sConstellation", "Zd")

    def test_SumShading은_구조적_요약이_센_값이다(self):
        codings = [
            _coding(dets=["C'F"]), _coding(dets=["FT"]),
            _coding(dets=["FV"]), _coding(dets=["FY"]),
        ] + [_coding() for _ in range(12)]
        summary, _, _ = _run(codings)
        assert summary["SumShading"] == (
            summary["SumC_prime"] + summary["SumT"]
            + summary["SumV"] + summary["SumY"]
        )
        assert summary["SumShading"] == 4

    def test_PureC는_Cn을_포함한다(self):
        """`Cn`을 넣고 빼는 판단이 두 자리에 각각 있으면 조용히 갈린다."""
        codings = [_coding(dets=["C"]), _coding(dets=["Cn"])] + [
            _coding() for _ in range(14)
        ]
        _, lower, _ = _run(codings)
        assert lower["affection"]["Pure C"] == 2


class TestCognitiveSpecialList:
    """Sum6·WSum6·GHR 1단계가 **같은 목록**을 본다."""

    def test_가중치_dict가_목록의_출처다(self):
        from app.modules.examination.rorschach.scoring import _COGNITIVE_SPECIALS

        assert _COGNITIVE_SPECIALS == frozenset(_COGNITIVE_SPECIAL_WEIGHTS)

    def test_수준2는_전체_목록의_부분집합이다(self):
        assert _LEVEL2_SPECIALS <= frozenset(_COGNITIVE_SPECIAL_WEIGHTS)

    def test_Sum6와_WSum6가_같은_모집단을_센다(self):
        """부호 하나당 1건씩 넣으면 Sum6 = 부호 개수, WSum6 = 가중치 합이다.

        목록이 두 벌로 갈리면 이 등식이 깨진다.
        """
        codings = [
            _coding(specials=[k]) for k in _COGNITIVE_SPECIAL_WEIGHTS
        ] + [_coding() for _ in range(6)]
        _, lower, _ = _run(codings)
        assert lower["ideation"]["Sum6"] == len(_COGNITIVE_SPECIAL_WEIGHTS)
        assert lower["ideation"]["WSum6"] == sum(_COGNITIVE_SPECIAL_WEIGHTS.values())
        assert lower["ideation"]["Lv2"] == len(_LEVEL2_SPECIALS)
