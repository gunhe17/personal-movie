"""AI Service 의존성 주입 설정"""
from functools import lru_cache

from app.core.config import settings
from app.infrastructure.ai.base import AIService


@lru_cache
def get_ai_service() -> AIService:
    """AI 서비스 인스턴스 반환 — RemoteAIService (AI 서버 연동)"""
    from app.infrastructure.ai.remote import RemoteAIService
    return RemoteAIService(
        base_url=settings.AI_SERVICE_URL,
        interpretation_url=settings.AI_INTERPRETATION_URL,
        sct_score_url=settings.AI_SCT_SCORE_URL,
        rorschach_score_url=settings.AI_RORSCHACH_SCORE_URL,
        report_summarize_url=settings.AI_REPORT_SUMMARIZE_URL,
        report_api_key=settings.OPENROUTER_API_KEY,
        report_base_url=settings.AI_REPORT_BASE_URL,
        report_model=settings.AI_REPORT_MODEL,
        comprehensive_url=settings.AI_COMPREHENSIVE_URL,
    )
