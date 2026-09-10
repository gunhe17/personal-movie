"""환경 설정 관리 — MindBom (마인드봄)"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://mindbom:mindbom_dev@localhost:5432/mindbom"

    # JWT
    JWT_SECRET_KEY: str = "mindbom-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # App
    APP_ENV: str = "development"
    DEBUG: bool = True
    APP_NAME: str = "MindBom"
    APP_VERSION: str = "0.1.0"

    # Frontend
    FRONTEND_URL: str = "http://localhost:4503"

    # AI Service (sLLM — on-premise / mock)
    AI_SERVICE_URL: str = "http://localhost:8100"
    AI_INTERPRETATION_URL: str = "http://interpretation.api.imomtae.com"
    AI_SCT_SCORE_URL: str = ""        # 비어있으면 룰베이스 채점 폴백
    # Rorschach 채점 — AXSprint Inference 서버 베이스 URL (비동기 큐).
    # 호출 시 {base}/jobs/score 로 잡 제출하고 {base}/jobs/{id} 로 폴링.
    # 비어있으면 룰베이스 채점 폴백.
    AI_RORSCHACH_SCORE_URL: str = ""
    # 통합 요약 provider 우선순위: AI_REPORT_SUMMARIZE_URL(AI팀 서버) > LLM(OpenRouter 등) > 룰 폴백
    AI_REPORT_SUMMARIZE_URL: str = ""
    # 종합보고서 초안 — 비어있으면 룰베이스 초안 폴백
    AI_COMPREHENSIVE_URL: str = ""
    AI_SERVICE_ENABLED: bool = False  # False면 Mock 사용

    # OpenAI (Whisper / gpt-4o-transcribe-diarize)
    OPENAI_API_KEY: str = ""

    # 통합 보고서 요약 LLM — OpenAI 호환 엔드포인트(OpenRouter 경유 Gemini Flash 등)
    OPENROUTER_API_KEY: str = ""  # OpenRouter 키 (sk-or-...)
    AI_REPORT_BASE_URL: str = "https://openrouter.ai/api/v1"
    AI_REPORT_MODEL: str = "google/gemini-2.5-flash"  # OpenRouter 경유 Gemini Flash

    # File Storage
    STORAGE_BACKEND: str = "s3"  # "local" | "s3"
    STORAGE_PATH: str = "/tmp/mindbom-storage"  # local 전용

    # S3
    S3_BUCKET: str = ""
    S3_REGION: str = "ap-northeast-2"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""

    # Audit (GMP/SaMD 감사추적)
    AUDIT_ENABLED: bool = True

    # SMTP (비밀번호 재설정 이메일 발송)
    SMTP_SERVER: str = ""
    SMTP_PORT: int = 587
    HOST_EMAIL: str = ""
    HOST_PASSWORD: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache
def get_settings() -> Settings:
    """설정 싱글톤 인스턴스 반환"""
    return Settings()


settings = get_settings()
