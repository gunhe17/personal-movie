"""프로토콜 타당성 — R<14면 해석하지 않는다.

무엇을 막는 테스트인가
----------------------
Exner CS의 명문 규칙이다: **R(총 반응 수)이 14 미만인 프로토콜은 해석하지 않고
재실시한다.** 권고가 아니라 타당성 규칙이다.

그런데 이 시스템은 R 하한을 보지 않았다(2026-08-20 발견). R=3짜리
프로토콜에서도 구조요약과 특수지표(SCZI/DEPI/PTI…)가 그대로 나왔고,
그게 AI 해석 초안까지 흘러갔다.

왜 치명적인가: R이 작으면 비율이 튄다. R=3에서 X+%는 0.33 아니면 0.67
둘 중 하나이고, 그 값이 PTI 판정에 들어간다. **타당하지 않은 프로토콜에서
뽑은 지표로 CDSS가 임상가를 틀린 방향으로 민다** — CDSS의 최악 실패 모드다.

설계
----
구조요약(상단 집계)은 계산한다 — 임상가가 "몇 개 나왔나"를 봐야 재실시를
판단할 수 있다. **봉인하는 것은 해석 산출물**이다: 하단 클러스터와 특수지표.

R==0(아직 채점 전)과 R<14(채점했으나 부족)는 다른 상태이므로 구분한다.
"""
import re

import pytest

from app.modules.examination.rorschach.scoring import (
    MIN_INTERPRETABLE_R,
    calculate_lower_section,
    calculate_special_indices,
    calculate_structural_summary,
    protocol_validity,
)


def _coding(loc="W", fq="o", dets=None, contents=None):
    return {
        "location": loc, "dq": "o", "determinants": dets or ["F"],
        "fq": fq, "pair": False, "contents": contents or ["A"],
        "popular": False, "z_score": None, "special_scores": [],
    }


def _protocol(n: int):
    """반응 n개짜리 프로토콜 — 카드는 고르게 분산."""
    codings = [_coding() for _ in range(n)]
    cards = [(i % 10) + 1 for i in range(n)]
    return codings, cards


class TestValidityJudgment:
    def test_threshold_is_exner_standard(self):
        assert MIN_INTERPRETABLE_R == 14

    @pytest.mark.parametrize("r,expected", [
        (0,  "not_scored"),
        (1,  "insufficient_r"),
        (13, "insufficient_r"),
        (14, "valid"),
        (27, "valid"),
    ])
    def test_verdict(self, r, expected):
        assert protocol_validity(r) == expected


class TestSummaryStillComputed:
    """구조요약은 계산한다 — 임상가가 재실시를 판단하려면 숫자를 봐야 한다."""

    def test_counts_are_real_even_when_short(self):
        codings, cards = _protocol(5)
        s = calculate_structural_summary(codings, cards)
        assert s["R"] == 5
        assert s["location"]["W"] == 5

    def test_validity_is_reported_in_summary(self):
        codings, cards = _protocol(5)
        assert calculate_structural_summary(codings, cards)["validity"] == "insufficient_r"

        codings, cards = _protocol(14)
        assert calculate_structural_summary(codings, cards)["validity"] == "valid"


def _full(n: int):
    """반응 n개로 상단·하단·특수지표를 모두 계산한다."""
    codings, cards = _protocol(n)
    summary = calculate_structural_summary(codings, cards)
    lower = calculate_lower_section(codings, cards, summary)
    indices = calculate_special_indices(codings, cards, summary, lower)
    return summary, lower, indices


class TestInterpretationSealed:
    """해석 산출물은 봉인한다 — 튄 비율이 지표로 나가면 안 된다."""

    def test_lower_section_sealed_below_threshold(self):
        _, lower_13, _ = _full(13)
        _, lower_0, _ = _full(0)
        assert lower_13 == lower_0, "R<14인데 하단 클러스터가 값을 내놓았다"

    def test_special_indices_sealed_below_threshold(self):
        _, _, idx_13 = _full(13)
        _, _, idx_0 = _full(0)
        assert idx_13 == idx_0, "R<14인데 특수지표가 값을 내놓았다"

    def test_computed_at_threshold(self):
        """딱 14면 계산한다 — 경계에서 꺼지면 안 된다."""
        _, lower_14, idx_14 = _full(14)
        _, lower_0, idx_0 = _full(0)
        assert lower_14 != lower_0
        assert idx_14 != idx_0


class TestRegressionOnRealisticProtocol:
    """정상 길이 프로토콜은 예전과 똑같이 동작해야 한다."""

    def test_typical_protocol_unaffected(self):
        summary, lower, indices = _full(22)
        assert summary["validity"] == "valid"
        assert summary["R"] == 22
        _, lower_0, idx_0 = _full(0)
        assert lower != lower_0
        assert indices != idx_0


# ---------------------------------------------------------------------------
# 봉인이 PDF까지 이어지는가
#
# 서비스가 봉인해도 템플릿이 그 빈 값을 세면 봉인이 풀린다. 실제로 그랬다
# (2026-08-26 발견): 템플릿에 `validity` 참조가 0건이라
#   - 특수지표는 빈 체크리스트를 세서 "S-CON 정상 범위 (0 / 8)"으로,
#   - 하단 클러스터는 전부 0인 dict를 "Lambda 0 · XA% 0"으로 인쇄했다.
# **해석하지 않기로 봉인한 프로토콜에서 자살지표가 음성으로 인쇄된 것이다.**
# 화면(Results.svelte)에는 주황 배너가 있었으니, PDF만 받는 사람에게만
# 신호가 0이었다 — 화면으로는 절대 잡히지 않는 종류의 실패다.
# ---------------------------------------------------------------------------

def _render_report(validity: str, R: int, lower: dict, special: dict) -> str:
    """PDF 템플릿을 HTML까지만 렌더한다(WeasyPrint 없이)."""
    from jinja2 import Environment, FileSystemLoader

    from app.modules.examination.report.service import TEMPLATE_DIR
    from app.modules.examination.rorschach.schemas import StructuralSummaryResponse

    # 스키마 필드를 타입별 기본값으로 채운다 — 템플릿이 참조하는 키를
    # 손으로 나열하면 필드가 늘 때 여기가 먼저 조용히 낡는다.
    summary: dict = {}
    for name, f in StructuralSummaryResponse.model_fields.items():
        ann = str(f.annotation)
        if "dict" in ann:
            summary[name] = {}
        elif "list" in ann:
            summary[name] = []
        elif "float" in ann:
            summary[name] = 0.0
        elif "int" in ann:
            summary[name] = 0
        else:
            summary[name] = ""
    summary.update(R=R, validity=validity, lower_section=lower, special_indices=special)

    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=True)
    html = env.get_template("rorschach_report.html").render(
        client_name="테스트", gender_label="-", birth_date="-", exam_date="-",
        examiner_name="-", report_date="-", report_date_short="-",
        summary=summary, regions=[], cards_grouped=[], total_responses=R,
    )
    # 지면에 실제로 찍히는 것만 본다 — <style> 블록의 클래스명과
    # HTML 주석의 설명 문구는 인쇄되지 않는다.
    body = html.split("<body>", 1)[1]
    return re.sub(r"<!--.*?-->", "", body, flags=re.DOTALL)


class TestSealSurvivesIntoPdf:
    def test_sealed_protocol_prints_no_verdict(self):
        _, lower, indices = _full(9)
        body = _render_report("insufficient_r", 9, lower, indices)
        assert "정상 범위" not in body, "봉인된 프로토콜에서 특수지표 판정이 인쇄됐다"
        assert "⚠ 양성" not in body

    def test_sealed_protocol_shows_banner_and_reason(self):
        _, lower, indices = _full(9)
        body = _render_report("insufficient_r", 9, lower, indices)
        assert 'class="validity-banner"' in body, "PDF에 해석 불가 안내가 없다"
        # 섹션은 제목을 남기고 본문만 대체한다 — 통째로 사라지면 생성 실패로 읽힌다.
        assert body.count('class="sealed-body"') == 2, "§3·§4 두 곳 모두 대체돼야 한다"
        assert "3. Lower Section" in body
        assert "4. 특수 지표" in body

    def test_not_scored_uses_its_own_wording(self):
        _, lower, indices = _full(0)
        body = _render_report("not_scored", 0, lower, indices)
        assert 'class="validity-banner"' in body
        assert "채점된 반응이 없" in body
        assert "재실시" not in body, "아직 채점 안 한 검사에 재실시를 권고하면 안 된다"

    def test_valid_protocol_prints_everything(self):
        summary, lower, indices = _full(22)
        body = _render_report("valid", 22, lower, indices)
        assert 'class="validity-banner"' not in body
        assert 'class="sealed-body"' not in body
        assert "정상 범위" in body or "⚠ 양성" in body
