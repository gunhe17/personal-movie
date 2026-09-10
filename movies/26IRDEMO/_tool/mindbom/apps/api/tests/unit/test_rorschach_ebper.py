"""EBPer는 **세 준거를 모두 만족할 때만** 계산한다.

무엇을 막는 테스트인가
----------------------
출처: 『로르샤하 종합체계 워크북』(Exner) 129쪽 핵심영역 4번.
"EBPer는 EB에 기초하여 특징적인 양식이 나타나는 **경우에만** 계산한다.
다음의 세 가지 준거를 적용하여 결정한다."

    1. EA ≥ 4.0
    2. Lambda < 1.0
    3. EA가 4.0~10.0이면 EB 두 값의 차이 ≥ 2.0 / EA ≥ 10.0이면 ≥ 2.5

코드는 준거 1만 보고 있었다(2026-08-26 발견). **계산하면 안 되는
프로토콜에서도 값이 나왔다.** 남은 조건 `sum_m == 0 or w_sum_c == 0`은
0나눗셈 방지일 뿐 원전 준거가 아니다.

미해당을 `0.0`으로 내보내던 것도 같은 문제다. EBPer는 큰 값을 작은 값으로
나눈 비율이라 **1.0 미만이 나올 수 없다** — 0은 계산된 값처럼 읽히는
거짓 값이다.

같은 쪽 예시로 대조한다: EA=11.0, L=0.55, EB=7:4.0 → 차이 3.0 → 7/4.0 = 1.8.
(**소수 1자리다.** 예시가 1.75가 아니라 1.8이라고 못박는다.)
"""
import pytest

from app.modules.examination.rorschach.scoring import _eb_per


class TestWorkbookExample:
    def test_matches_workbook_129p(self):
        """EA=11.0, L=0.55, EB=7:4.0 → 1.8"""
        assert _eb_per(sum_m=7, w_sum_c=4.0, ea=11.0, lam=0.55) == 1.8

    def test_rounds_to_one_decimal(self):
        """7/4.0 = 1.75인데 워크북은 1.8이라고 쓴다."""
        assert _eb_per(sum_m=7, w_sum_c=4.0, ea=11.0, lam=0.55) != 1.75


class TestCriteria:
    def test_1_ea_below_4_is_not_computed(self):
        assert _eb_per(sum_m=3, w_sum_c=0.5, ea=3.5, lam=0.5) is None

    @pytest.mark.parametrize("lam", [1.0, 1.5, 3.0])
    def test_2_lambda_at_or_above_1_is_not_computed(self, lam):
        """예전엔 이 준거가 없어 형태 편중 프로토콜에서도 값이 나왔다."""
        assert _eb_per(sum_m=7, w_sum_c=4.0, ea=11.0, lam=lam) is None

    def test_2_undefined_lambda_is_not_computed(self):
        """L이 정의되지 않는다(R=F)는 것은 형태 편중이 극단이라는 뜻이다 —
        'L < 1.0'을 만족한다고 볼 수 없다."""
        assert _eb_per(sum_m=7, w_sum_c=4.0, ea=11.0, lam=None) is None

    def test_3_band_below_10_uses_2_0(self):
        # EA 8.0, 차이 2.0 → 계산된다
        assert _eb_per(sum_m=5, w_sum_c=3.0, ea=8.0, lam=0.5) is not None
        # 차이 1.5 → 안 된다
        assert _eb_per(sum_m=4.5, w_sum_c=3.0, ea=7.5, lam=0.5) is None

    def test_3_band_at_or_above_10_uses_2_5(self):
        # EA 10.0, 차이 2.5 → 계산된다
        assert _eb_per(sum_m=6.5, w_sum_c=4.0, ea=10.0, lam=0.5) is not None
        # 차이 2.0 → 안 된다 (4.0~10.0 구간이면 통과했을 값)
        assert _eb_per(sum_m=6, w_sum_c=4.0, ea=10.0, lam=0.5) is None


class TestNoFalseValues:
    def test_zero_denominator_is_not_computed(self):
        """한쪽이 0이면 비율을 만들 수 없다 — 준거 3은 통과할 수 있는 분기다."""
        assert _eb_per(sum_m=5, w_sum_c=0.0, ea=5.0, lam=0.5) is None

    def test_result_is_never_below_1(self):
        """큰 값을 작은 값으로 나누므로 1.0 미만은 나올 수 없다.
        예전의 미해당 표시 0.0이 왜 거짓 값이었는지가 여기 있다."""
        for m, wc, ea in [(7, 4.0, 11.0), (4.0, 7, 11.0), (5, 3.0, 8.0)]:
            v = _eb_per(sum_m=m, w_sum_c=wc, ea=ea, lam=0.5)
            if v is not None:
                assert v >= 1.0
