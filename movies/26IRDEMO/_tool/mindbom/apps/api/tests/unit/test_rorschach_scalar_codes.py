"""칸 하나짜리 부호(dq·fq·zScore)도 저장 시점에 막는다.

무엇을 막는 테스트인가
----------------------
저장 경로의 부호 검증은 **목록 셋(determinants·contents·specialScores)에만**
걸려 있었다. `dq`·`fq`·`z_score`는 무검증으로 통과했다(2026-08-26 발견).

그래도 되는 줄 알았던 이유는 `coding_codes.py`에 적힌 설명이었다:
"dq / fq / zScore — 값을 그대로 세거나 표를 조회할 뿐 부호를 열거하지 않는다."
**사실이 아니었다.** 셋 다 이름으로 열거된다:

    dq       dq_counter.get("+"/"o"/"v/+"/"v")   → DQ+ · DQv
    fq       fq.get("+"/"o"/"u"/"-"/"none")      → X+% · Xu% · X-% · XA% · F+%
    z_score  `z in Z_TABLE[card_no]`             → Zf · ZSum · Zd

그래서 AI가 z_score에 `"1.0"`을 주면 Z_TABLE 조회에서 빠져 **Zf가 하나
모자란 채로** 저장된다. 화면엔 값이 차 있고, 에러도 경고도 없다.
"맞아 보이는 값"이라 틀린 값보다 나쁘다.

빈 값은 위반이 아니다 — "아직 안 정했다"는 정상 상태다.
"""
import pytest

from app.modules.examination.rorschach.coding_codes import is_known_code
from app.modules.examination.rorschach.schemas import CodingUpdateRequest
from app.modules.examination.rorschach.scoring import calculate_structural_summary
from app.modules.examination.rorschach.services import _scoring_to_coding_dict


class _FakeScoring:
    """AI 인프라 결과의 최소 흉내 — 계약을 어긴 값을 넣어 본다."""

    def __init__(self, *, dq=None, fq=None, z=None):
        self.location = "W"
        self.dev_quality = dq
        self.determinants = ["F"]
        self.form_quality = fq
        self.content = ["A"]
        self.popular = False
        self.pair = False
        self.z_score = z
        self.special_scores = []


def _coding(**over) -> dict:
    base = {
        "location": "W", "dq": "o", "determinants": ["F"], "fq": "o",
        "pair": False, "contents": ["A"], "popular": None,
        "z_score": None, "special_scores": [],
    }
    base.update(over)
    return base


class TestKnownCodeHelper:
    @pytest.mark.parametrize("group,code", [
        ("dq", "+"), ("dq", "v/+"), ("fq", "none"), ("fq", "-"),
        ("zScore", "ZW"), ("zScore", "ZS"),
    ])
    def test_contract_codes_pass(self, group, code):
        assert is_known_code(group, code)

    @pytest.mark.parametrize("group,code", [
        ("dq", "O"), ("dq", "1.0"), ("fq", "ordinary"), ("fq", "x"),
        ("zScore", "1.0"), ("zScore", "Z"), ("zScore", "ZW+"),
    ])
    def test_off_contract_codes_fail(self, group, code):
        assert not is_known_code(group, code)

    @pytest.mark.parametrize("group", ["dq", "fq", "zScore"])
    @pytest.mark.parametrize("empty", [None, ""])
    def test_empty_is_allowed(self, group, empty):
        """'아직 안 정했다'는 오류가 아니다."""
        assert is_known_code(group, empty)


class TestClinicianWritePath:
    """임상가 저장 — 모르는 부호는 거부한다(400)."""

    def test_valid_coding_accepted(self):
        CodingUpdateRequest(coding=_coding(dq="+", fq="u", z_score="ZA"))

    @pytest.mark.parametrize("field,value", [
        ("dq", "1.0"), ("fq", "1.0"), ("z_score", "1.0"),
        ("dq", "O"), ("fq", "ordinary"), ("z_score", "ZW+"),
    ])
    def test_unknown_scalar_rejected(self, field, value):
        with pytest.raises(ValueError) as e:
            CodingUpdateRequest(coding=_coding(**{field: value}))
        assert value in str(e.value)

    def test_empty_scalars_accepted(self):
        CodingUpdateRequest(coding=_coding(dq=None, fq=None, z_score=None))


class TestAiWritePath:
    """AI 초안 — 모르는 부호는 **비운다**(목록 부호와 같은 규칙)."""

    def test_unknown_scalars_are_blanked(self):
        d = _scoring_to_coding_dict(_FakeScoring(dq="O", fq="ordinary", z=1.0))
        assert d["dq"] is None
        assert d["fq"] is None
        assert d["z_score"] is None

    def test_known_scalars_survive(self):
        d = _scoring_to_coding_dict(_FakeScoring(dq="+", fq="u", z="ZA"))
        assert (d["dq"], d["fq"], d["z_score"]) == ("+", "u", "ZA")

    def test_ai_label_z_is_not_mangled(self):
        """AI는 Z를 라벨로 준다 — 숫자로 바꾸지 않는다."""
        assert _scoring_to_coding_dict(_FakeScoring(z="ZW"))["z_score"] == "ZW"


class TestWhyItMattered:
    """검증이 없으면 지표가 조용히 어긋난다 — 그 사실 자체를 못 박는다."""

    def test_off_contract_z_silently_drops_from_zf(self):
        good = [_coding(z_score="ZW") for _ in range(14)]
        bad = [_coding(z_score="1.0") for _ in range(14)]
        cards = [(i % 10) + 1 for i in range(14)]

        assert calculate_structural_summary(good, cards)["Zf"] == 14
        assert calculate_structural_summary(bad, cards)["Zf"] == 0, (
            "계약 밖 z_score가 Zf에 들어갔다면 이 테스트의 전제가 바뀐 것이다"
        )

    def test_off_contract_fq_silently_drops_from_x_plus(self):
        good = [_coding(fq="o") for _ in range(14)]
        bad = [_coding(fq="ordinary") for _ in range(14)]
        cards = [(i % 10) + 1 for i in range(14)]

        assert calculate_structural_summary(good, cards)["X_plus_pct"] == 1.0
        assert calculate_structural_summary(bad, cards)["X_plus_pct"] == 0.0
