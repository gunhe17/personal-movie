"""스마트폰 과의존 성인·고령층 척도 플러그인

- 10문항, 4점 리커트 척도 (1~4점)
- 하위척도: 조절실패(1~3), 현저성(4~6), 문제적 결과(7~10)
- 연령대별 위험군 기준:
  - 성인(만20~59세): 고위험(≥29), 잠재적위험(24~28), 일반(≤23)
  - 고령층(만60세 이상): 고위험(≥28), 잠재적위험(24~27), 일반(≤23)
"""
from datetime import date

from ..protocol import AssessmentEngine
from ..types import ScoringResult, InterpretationResult, RiskLevel
from ..exceptions import EngineValidationError


class SmartphoneOverdependenceAdultEngine(AssessmentEngine):
    CODE = "SMARTPHONE_OVERDEPENDENCE_ADULT"
    NAME = "스마트폰 과의존 성인·고령층 척도"
    TOTAL_ITEMS = 10

    SUBSCALES = {
        "조절실패": [1, 2, 3],
        "현저성": [4, 5, 6],
        "문제적 결과": [7, 8, 9, 10],
    }

    # 연령대별 위험군 기준점
    CUTOFFS = {
        "adult": {"high": 29, "moderate": 24},    # 만20~59세
        "elderly": {"high": 28, "moderate": 24},   # 만60세 이상
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

        subscale_scores = {}
        for name, question_numbers in self.SUBSCALES.items():
            raw_score = sum(response_map[qn] for qn in question_numbers)
            max_score = len(question_numbers) * 4

            subscale_scores[name] = {
                "name": name,
                "code": name,
                "raw_score": float(raw_score),
                "max_score": max_score,
            }

        total_score = sum(response_map[i] for i in range(1, self.TOTAL_ITEMS + 1))

        age_group = self._determine_age_group(context)

        return {
            "total_score": float(total_score),
            "max_total_score": 40,
            "subscales": subscale_scores,
            "metadata": {"age_group": age_group},
        }

    def interpret(self, scores: ScoringResult, context: dict | None = None) -> InterpretationResult:
        total = scores["total_score"]
        age_group = scores.get("metadata", {}).get("age_group", "adult")
        cutoffs = self.CUTOFFS.get(age_group, self.CUTOFFS["adult"])

        age_label = "고령층" if age_group == "elderly" else "성인"

        if total >= cutoffs["high"]:
            risk_level: RiskLevel = "high"
            risk_label = "고위험 사용자군"
            summary = f"스마트폰 과의존 고위험 ({age_label})"
            description = (
                "스마트폰 사용에 대한 통제력을 상실한 상태로 일상생활의 상당시간을 스마트폰 "
                "사용에 소비하고 있으며 대인관계 갈등이나 일상의 역할 문제, 건강 "
                "문제 등이 심각하게 발생한 상태로 ICT 역량 발휘를 억제할 위험성이 높은 상태입니다. "
                "스마트폰 과의존 경향성이 매우 높으므로 관련 기관의 전문적인 지원과 도움이 "
                "요청됩니다."
            )
            recommendations = [
                "관련 기관의 전문적인 지원과 도움을 요청하세요",
                "스마트폰 사용 시간을 체계적으로 관리하세요",
                "전문 상담을 통해 과의존 해소 방안을 모색하세요",
            ]
        elif total >= cutoffs["moderate"]:
            risk_level = "moderate"
            risk_label = "잠재적위험 사용자군"
            summary = f"스마트폰 과의존 잠재적 위험 ({age_label})"
            description = (
                "스마트폰 사용에 대한 조절이 약화된 상태이며 그로 인해 이용시간이 증가하여 "
                "대인관계 갈등이나 일상의 역할에 문제가 발생하기 시작한 단계로 ICT 역량 발휘에 "
                "부정적 영향을 미칠 위험성이 존재하는 상태입니다. "
                "스마트폰 과의존 위험을 깨닫고 스스로 조절하고 계획적으로 사용하도록 "
                "노력해야 합니다. 스마트폰 과의존에 대한 주의가 요망됩니다."
            )
            recommendations = [
                "스마트폰 과의존 위험을 인식하고 사용 습관을 점검하세요",
                "스스로 조절하고 계획적으로 사용하도록 노력하세요",
                "필요시 전문가 상담을 고려하세요",
            ]
        else:
            risk_level = "low"
            risk_label = "일반사용자군"
            summary = f"일반 사용자군 ({age_label})"
            description = (
                "스마트폰을 조절된 형태로 사용하고 있어서 일상생활의 주요 활동이 스마트폰으로 "
                "인해 훼손 되는 문제가 발생하지 않는 상태로 ICT 역량 발휘를 위한 기본 조건을 "
                "충족시키고 있는 상태입니다. "
                "스마트폰을 건전하게 활용하기 위해 지속적으로 자기 점검을 해야 합니다."
            )
            recommendations = [
                "현재의 건강한 사용 습관을 유지하세요",
                "스마트폰을 건전하게 활용하기 위해 지속적으로 자기 점검을 하세요",
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

    def _determine_age_group(self, context: dict | None) -> str:
        """birth_date에서 만 나이 계산 후 age_group 반환"""
        if not context or not context.get("birth_date"):
            return "adult"

        try:
            birth_str = context["birth_date"]
            if isinstance(birth_str, date):
                birth_date = birth_str
            else:
                birth_date = date.fromisoformat(str(birth_str))

            today = date.today()
            age = today.year - birth_date.year - (
                (today.month, today.day) < (birth_date.month, birth_date.day)
            )
            return "elderly" if age >= 60 else "adult"
        except (ValueError, TypeError):
            return "adult"

    def _get_subscale_high(self, name: str) -> str:
        texts = {
            "조절실패": "스마트폰 사용에 대한 자기 조절 능력이 크게 부족한 상태입니다.",
            "현저성": "스마트폰 사용이 생활에서 가장 두드러진 활동이 되었습니다.",
            "문제적 결과": "스마트폰 사용으로 인해 일상생활에 심각한 문제가 발생하고 있습니다.",
        }
        return texts.get(name, "높은 수준입니다.")

    def _get_subscale_medium(self, name: str) -> str:
        texts = {
            "조절실패": "스마트폰 사용 조절에 어려움이 있는 상태입니다.",
            "현저성": "스마트폰 사용이 일상에서 점점 중요한 비중을 차지하고 있습니다.",
            "문제적 결과": "스마트폰 사용으로 인한 문제가 일부 나타나고 있습니다.",
        }
        return texts.get(name, "보통 수준입니다.")

    def _get_subscale_low(self, name: str) -> str:
        texts = {
            "조절실패": "스마트폰 사용을 스스로 적절히 조절하고 있습니다.",
            "현저성": "스마트폰이 일상에서 과도한 비중을 차지하지 않습니다.",
            "문제적 결과": "스마트폰 사용으로 인한 문제가 거의 없습니다.",
        }
        return texts.get(name, "낮은 수준입니다.")


from ..registry import registry
registry.register(SmartphoneOverdependenceAdultEngine)
