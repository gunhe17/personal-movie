from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://imomtae:imomtae_dev@postgres:5432/imomtae"

    # JWT
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # App
    APP_ENV: str = "development"
    DEBUG: bool = True
    APP_NAME: str = "SaaS Center Platform"
    APP_VERSION: str = "1.0.0"

    # AWS S3 Storage
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-northeast-2"
    S3_BUCKET_NAME: str = ""
    S3_BUCKET_ENABLED: bool = True  # Phase 1.5에서 True로 변경

    # SMTP Email
    SMTP_SERVER: str = "smtps.hiworks.com"
    SMTP_PORT: int = 587  # STARTTLS (더 안정적)
    HOST_EMAIL: str = "no-reply@insighter.co.kr"
    HOST_PASSWORD: str = "" # 관리자 문의 후 발급 받음

    # LLM API Keys
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Agent LLM (skill 선택 + context 추출)
    AGENT_LLM_PROVIDER: str = "openrouter"
    AGENT_LLM_MODEL: str = "google/gemini-2.5-flash"

    # new_agent LLM (tool-use 루프 — docs/new-agent-rebuild.md)
    # 2026-08: prod 오케 laguna 제거 → gemini-3.1-flash-lite (group_by E2–E5·표면 실측 모델과 정합).
    # OpenRouter 경유. 롤백: poolside/laguna-s-2.1 (+ POOLSIDE 키).
    NEW_AGENT_LLM_MODEL: str = "google/gemini-3.1-flash-lite"
    # 최종 응답 위임 — 오케가 이미 gemini면 이중 호출 불필요(빈 문자열=비활성, 오케 초안 그대로).
    # laguna 오케 복귀 시에만 google/gemini-3.1-flash-lite 등 재활성 검토.

    # Small LLM (verify 등 경량 태스크)
    SMALL_LLM_PROVIDER: str = "openai"
    SMALL_LLM_MODEL: str = "gpt-4.1-mini"

    # Reflex LLM (parameter 추출 + intent guard)
    REFLEX_LLM_PROVIDER: str = "openrouter"
    REFLEX_LLM_MODEL: str = "google/gemini-2.5-flash-lite"

    # Checkpoint LLM (3-way 분류)
    CHECKPOINT_LLM_PROVIDER: str = "openai"
    CHECKPOINT_LLM_MODEL: str = "gpt-4.1-mini"

    # Profile (사용자 프로필 심층 분석 — 모델은 AI 게이트웨이 resolve_config 소관)
    PROFILE_STALE_DAYS: int = 7  # 장기 profile 재분석 주기. dev에선 0으로 매 대화 갱신

    # Embedding
    EMBEDDING_PROVIDER: str = "openai"
    EMBEDDING_MODEL: str = "text-embedding-3-large"

    # Reflex (2-Step kNN matcher)
    REFLEX_K: int = 5
    REFLEX_VOTING: str = "majority"  # "majority" | "weighted"
    REFLEX_RELIABLE_THRESHOLD: float = 0.88
    REFLEX_REJECT_THRESHOLD: float = 0.65

    # Agent Rate Limiting
    AGENT_RATE_LIMIT_ENABLED: bool = True
    AGENT_RATE_LIMIT_PER_MINUTE: int = 100     # /stream 요청/멤버/분
    AGENT_MAX_CONCURRENT_STREAMS: int = 1     # 동시 stream/멤버

    # Context compaction
    COMPACT_THRESHOLD: int | None = 100_000

    # Frontend
    FRONTEND_URL: str = "http://localhost:3503"

    # Assessment Public URLs (공개 페이지)
    ASSESSMENT_RESULT_BASE_URL: str = ""  # 비어있으면 FRONTEND_URL + /verify-result 사용
    ONLINE_ASSESSMENT_BASE_URL: str = ""  # 비어있으면 FRONTEND_URL + /verify-link 사용

    # Firebase Cloud Messaging (Web Push)
    FIREBASE_ENABLED: bool = False
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_PRIVATE_KEY_ID: str = ""
    FIREBASE_PRIVATE_KEY: str = ""
    FIREBASE_CLIENT_EMAIL: str = ""

    # STT
    STT_MODEL: str = "whisper-1"
    STT_DIARIZE_MODEL: str = "gpt-4o-transcribe-diarize"
    STT_DIARIZE_ENABLED: bool = True

    # STT Streaming (듀얼 모드: "whisper_chunk" | "aws_transcribe")
    STT_STREAMING_PROVIDER: str = "whisper_chunk"
    AWS_TRANSCRIBE_LANGUAGE_CODE: str = "ko-KR"

    # AI Summary
    SUMMARY_MODEL: str = "gpt-4o-mini"
    SUMMARY_MAX_TOKENS: int = 2048

    # OpenRouter
    OPENROUTER_API_KEY: str = ""

    # Poolside 직결 (laguna) — 키 있으면 poolside/* 모델은 직결이 기본
    POOLSIDE_API_KEY: str = ""
    # 프로덕션 전용 키 — 실험(lab)과 격리(lab이 프로덕션 한도를 갉아먹어 429 유발하던 구조 차단).
    # 미지정 POOLSIDE_API_KEY는 PROD로 폴백(프로덕션 기본), lab은 _1~3 로테이션 풀만 사용(client._key_pool)
    POOLSIDE_API_KEY_PROD: str = ""
    POOLSIDE_API_KEY_1: str = ""
    POOLSIDE_API_KEY_2: str = ""
    POOLSIDE_API_KEY_3: str = ""

    def model_post_init(self, __context) -> None:
        if not self.POOLSIDE_API_KEY:
            self.POOLSIDE_API_KEY = self.POOLSIDE_API_KEY_PROD
    GROK_API_KEY: str = ""  # stt 트랙 lab이 .env 공유 — Settings extra 금지라 선언 필요
    POOLSIDE_BASE_URL: str = "https://inference.poolside.ai/v1"
    POOLSIDE_DIRECT: bool = True  # 킬스위치 — false면 poolside/*도 OpenRouter 경유

    # Toss Payments
    TOSS_SECRET_KEY: str = ""
    TOSS_CLIENT_KEY: str = ""
    TOSS_API_URL: str = "https://api.tosspayments.com/v1"
    TOSS_WEBHOOK_SECRET: str = ""  # 토스 웹훅 시크릿 (대시보드에서 설정)

    # Internal API
    INTERNAL_API_SECRET: str = ""  # 내부 API 인증 시크릿 (cron/스케줄러 수동 트리거용)

    # Redis
    REDIS_URL: str = ""
    REDIS_ENABLED: bool = False

    # AI Worker Mode ("embedded" = 기존 동작, "distributed" = Redis Worker 분리)
    AI_WORKER_MODE: str = "embedded"

    # Scheduler (APScheduler)
    # 기본 False — 명시적으로 활성화한 환경에서만 백그라운드 잡 실행.
    # 프로덕션 K8s 다중 replica 환경에서도 True로 두면 advisory lock이 중복 방지.
    ENABLE_SCHEDULER: bool = False

    # LGU+ Message Hub (Kakao AlarmTalk)
    LGU_API_URL: str = "https://api.msghub.uplus.co.kr"
    KAKAO_ALARM_TALK_AUTH_NUM: str = ""
    KAKAO_ALARM_TALK_API_KEY: str = ""
    KAKAO_ALARM_TALK_API_PWD: str = ""
    KAKAO_ALARM_TALK_SENDER_KEY: str = ""
    KAKAO_ALARM_TALK_CALLBACK: str = ""
    KAKAO_NOTIFICATION_TEMPLATE_CODE: str = ""  # 상담사 알림용 알림톡 템플릿 코드

    # 발송 드라이런 — True면 LGU+를 부르지 않고 성공으로 처리한다.
    # 자격증명이 없는 로컬(개발·영상 촬영)에서 발송 실패가 흐름을 끊는 것을 막는다. 운영은 항상 False.
    MESSAGING_DRY_RUN: bool = False

    # 내담자 자동 SMS (검사/상담 접수 시 안내 문자)
    # False: 자동 발송 비활성화. send_result/send_link 같은 명시적 발송은 영향 없음.
    ENABLE_CLIENT_AUTO_SMS: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

# (P1) get_storage_client() 는 app/infrastructure/storage/provider.py 로 이전됨.
