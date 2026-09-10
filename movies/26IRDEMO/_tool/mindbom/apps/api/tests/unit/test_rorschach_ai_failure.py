"""AI 채점이 실패하면 **실패라고 말한다** — 목업으로 메우지 않는다.

무엇을 막는 테스트인가
----------------------
`score_rorschach`에는 룰베이스 목업 폴백이 있었다(2026-08-26 제거). 세 갈래로
빠졌다: AI 서버 URL 미설정 / 호출 2회 실패 / AI가 빈 결과 반환.

목업은 카드·반응 번호로 부호를 돌려 만든 **완전히 그럴듯한 코딩**이었고
`confidence=0.7~0.9`를 달고 저장됐다. 화면은 'AI 채점이 완료되었습니다'라는
토스트를 띄웠고, 유일한 표식인 `[Mock]` 문자열은 팝오버가 띄우지 않았다.
결과적으로 **임상가가 AI가 본 적 없는 부호를 검토하고 '확정'을 누를 수 있었다.**

CDSS 원칙(AI 초안 → 임상가 확인)은 초안이 실제로 AI의 것일 때만 성립한다.
실패를 성공으로 바꿔 반환하는 것은 그 전제를 무너뜨린다 — 확신도를 낮추는
것으로 대신할 수 없다. "자신 없다"와 "보지 않았다"는 다른 축이다.
"""
import pytest

from app.core.exceptions import ExternalServiceException
from app.infrastructure.ai import remote as remote_mod
from app.infrastructure.ai.remote import RemoteAIService


def _service(rorschach_score_url: str = "") -> RemoteAIService:
    return RemoteAIService(base_url="http://unused", rorschach_score_url=rorschach_score_url)


class TestNoMockFallbackExists:
    def test_rule_scorer_is_gone(self):
        """목업 함수 자체가 없어야 한다 — 남아 있으면 언젠가 다시 불린다."""
        assert not hasattr(remote_mod, "_rule_score_rorschach"), (
            "로르샤하 룰베이스 목업이 되살아났다. "
            "AI 채점 실패는 목업이 아니라 ExternalServiceException으로 알린다."
        )


class TestFailuresAreReported:
    @pytest.mark.asyncio
    async def test_missing_url_raises(self):
        with pytest.raises(ExternalServiceException) as e:
            await _service("").score_rorschach(
                card_no=1, response_no=1, transcript="박쥐 같아요",
                location_marking={"area_code": "W"},
            )
        assert "AI_RORSCHACH_SCORE_URL" in str(e.value)

    @pytest.mark.asyncio
    async def test_missing_area_code_raises(self):
        """위치 없이 추론하게 두지 않는다 — 서비스 관문을 우회한 호출이다(§14-7)."""
        with pytest.raises(ExternalServiceException):
            await _service("http://ai.example").score_rorschach(
                card_no=1, response_no=1, transcript="박쥐 같아요",
                location_marking=None,
            )

    def test_empty_ai_result_raises(self):
        """AI가 결과를 안 냈으면 채점이 아니다."""
        with pytest.raises(ExternalServiceException):
            remote_mod._parse_rorschach_result(
                {"responses": []}, card_no=3, response_no=2, area_code="D1"
            )

    def test_real_ai_result_still_parsed(self):
        """정상 응답은 예전과 똑같이 매핑돼야 한다(회귀 방지)."""
        r = remote_mod._parse_rorschach_result(
            {"responses": [{"coding": {
                "location": "W", "dq": "o", "determinants": ["Ma"],
                "fq": "o", "contents": ["H"], "popular": True,
                "specialScores": ["INCOM1"],
            }, "cleanedText": "두 사람이 마주 보고 있다"}]},
            card_no=3, response_no=1, area_code="W",
        )
        assert r.location == "W"
        assert r.determinants == ["Ma"]
        assert r.popular is True
        assert r.special_scores == ["INCOM1"]
