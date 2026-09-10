"""스마트폰중독검사 (S-척도) 플러그인

- 15문항, 4점 리커트 척도
- 역채점: 8, 10, 13번
- 하위척도:
    일상생활장애(1,5,9,12,13),
    가상세계지향성(2,6) — 결과에 노출되지만 위험군 판정에는 미사용,
    금단(3,7,10,14),
    내성(4,8,11,15)
- 위험군 판정 (한국정보화진흥원 S척도 청소년 자가진단 기준):
    고위험: 총점 ≥ 45  OR  (일상≥16 AND 금단≥13 AND 내성≥14)
    잠재위험: 총점 42~44  OR  일상≥14  OR  금단≥12  OR  내성≥13
    일반: 그 외
"""
from ..protocol import AssessmentEngine
from ..types import ScoringResult, InterpretationResult, RiskLevel
from ..exceptions import EngineValidationError


class SmartphoneAddictionEngine(AssessmentEngine):
    CODE = "SMARTPHONE_ADDICTION"
    NAME = "스마트폰중독검사"
    TOTAL_ITEMS = 15

    # 역채점 문항
    REVERSE_ITEMS = {8, 10, 13}

    # 하위척도 정의 (공식 S척도 4요인 구조)
    SUBSCALES = {
        "일상생활장애": [1, 5, 9, 12, 13],
        "가상세계지향성": [2, 6],
        "금단": [3, 7, 10, 14],
        "내성": [4, 8, 11, 15],
    }

    @property
    def code(self) -> str:
        return self.CODE

    @property
    def name(self) -> str:
        return self.NAME

    def validate_responses(self, responses: list[dict]) -> bool:
        if len(responses) != self.TOTAL_ITEMS:
            raise EngineValidationError(
                f"Expected {self.TOTAL_ITEMS} items, got {len(responses)}"
            )

        question_numbers = {r.get("question_number") for r in responses}
        expected = set(range(1, self.TOTAL_ITEMS + 1))
        if question_numbers != expected:
            raise EngineValidationError("Invalid question_numbers")

        for r in responses:
            value = r.get("answer_value")
            if not value or not (1 <= int(value) <= 4):
                raise EngineValidationError("Response must be 1-4")

        return True

    def calculate_scores(self, responses: list[dict], context: dict | None = None) -> ScoringResult:
        response_map = {
            int(r["question_number"]): int(r["answer_value"])
            for r in responses
        }

        def get_score(qnum: int) -> int:
            raw = response_map[qnum]
            return (5 - raw) if qnum in self.REVERSE_ITEMS else raw

        subscale_scores = {}
        for name, question_numbers in self.SUBSCALES.items():
            raw_score = sum(get_score(qn) for qn in question_numbers)
            max_score = len(question_numbers) * 4

            subscale_scores[name] = {
                "name": name,
                "code": name,
                "raw_score": float(raw_score),
                "max_score": max_score,
            }

        total_score = sum(get_score(i) for i in range(1, self.TOTAL_ITEMS + 1))

        return {
            "total_score": float(total_score),
            "max_total_score": 60,
            "subscales": subscale_scores,
            "metadata": {"reverse_items_applied": list(self.REVERSE_ITEMS)},
        }

    def interpret(self, scores: ScoringResult, context: dict | None = None) -> InterpretationResult:
        """위험군 판정은 공식 S척도 청소년 자가진단 기준에 따라 총점과 하위척도
        조합 조건을 함께 평가한다. 가상세계지향성은 결과에 노출되지만
        위험군 판정 조건에는 포함되지 않는다.
        """
        total = scores["total_score"]
        daily = scores["subscales"]["일상생활장애"]["raw_score"]
        withdrawal = scores["subscales"]["금단"]["raw_score"]
        tolerance = scores["subscales"]["내성"]["raw_score"]

        # 고위험: 총점 ≥ 45  OR  (일상≥16 AND 금단≥13 AND 내성≥14)
        is_high = (total >= 45) or (
            daily >= 16 and withdrawal >= 13 and tolerance >= 14
        )

        # 잠재위험: 42 ≤ 총점 ≤ 44  OR  일상≥14  OR  금단≥12  OR  내성≥13
        is_moderate = (not is_high) and (
            (42 <= total <= 44)
            or daily >= 14
            or withdrawal >= 12
            or tolerance >= 13
        )

        if is_high:
            risk_level: RiskLevel = "high"
            risk_label = "고위험사용자군"
            summary = "스마트폰 중독 고위험군"
            description = (
                "스마트폰 사용으로 인해 일상생활에서 심각한 장애를 보이며 "
                "내성 및 금단 현상이 나타납니다."
            )
            recommendations = [
                "전문 기관의 상담과 치료가 필요합니다",
                "즉시 전문가와 상담을 진행하세요",
                "스마트폰 사용 제한 계획을 수립하세요",
            ]
        elif is_moderate:
            risk_level = "moderate"
            risk_label = "잠재적위험사용자군"
            summary = "스마트폰 중독 잠재적 위험군"
            description = (
                "일상생활에서 장애를 보이며, 스마트폰 사용시간이 늘어나고 "
                "집착을 하게 됩니다."
            )
            recommendations = [
                "스마트폰 과다 사용의 위험을 인식하세요",
                "사용 시간을 체크하고 제한을 설정하세요",
                "필요시 전문가 상담을 고려하세요",
            ]
        else:
            risk_level = "low"
            risk_label = "일반사용자군"
            summary = "일반 사용자군"
            description = "스마트폰을 적절하게 사용하고 있습니다."
            recommendations = [
                "현재의 건강한 사용 습관을 유지하세요",
                "때때로 자가 점검을 수행하세요",
            ]

        subscale_interp = {}
        for name, subscale in scores["subscales"].items():
            score = subscale["raw_score"]
            max_score = subscale["max_score"]
            percentage = (score / max_score) * 100

            if percentage >= 75:
                subscale_interp[name] = self._get_subscale_high(name)
            elif percentage >= 50:
                subscale_interp[name] = self._get_subscale_medium(name)
            else:
                subscale_interp[name] = self._get_subscale_low(name)

        return {
            "risk_level": risk_level,
            "risk_label": risk_label,
            "summary": summary,
            "description": description,
            "recommendations": recommendations,
            "subscales": subscale_interp,
        }

    def _get_subscale_high(self, name: str) -> str:
        texts = {
            "일상생활장애": "일상생활에 심각한 지장을 받고 있습니다.",
            "가상세계지향성": "스마트폰이 다른 어떤 일상보다 매력적으로 여겨지고 있습니다.",
            "금단": "스마트폰 없이는 심각한 불안을 느낍니다.",
            "내성": "사용 시간을 조절하지 못하고 계속 늘어나고 있습니다.",
        }
        return texts.get(name, "높은 수준입니다.")

    def _get_subscale_medium(self, name: str) -> str:
        texts = {
            "일상생활장애": "일상생활에 일부 영향을 받고 있습니다.",
            "가상세계지향성": "스마트폰이 일상의 중요한 자리를 차지하고 있습니다.",
            "금단": "스마트폰이 없을 때 불편함을 느낍니다.",
            "내성": "사용 시간 조절에 어려움이 있습니다.",
        }
        return texts.get(name, "보통 수준입니다.")

    def _get_subscale_low(self, name: str) -> str:
        texts = {
            "일상생활장애": "일상생활에 미치는 영향이 적습니다.",
            "가상세계지향성": "스마트폰 외의 일상 활동에 균형 있게 시간을 쓰고 있습니다.",
            "금단": "스마트폰이 없어도 크게 불안하지 않습니다.",
            "내성": "사용 시간을 스스로 조절할 수 있습니다.",
        }
        return texts.get(name, "낮은 수준입니다.")


from ..registry import registry
registry.register(SmartphoneAddictionEngine)
