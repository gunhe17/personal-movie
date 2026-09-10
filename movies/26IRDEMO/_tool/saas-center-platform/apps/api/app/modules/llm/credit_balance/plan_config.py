import os
from enum import StrEnum


class AIPurpose(StrEnum):
    """모든 AI 호출 목적의 단일 진실 공급원 — 새 AI 기능은 반드시 여기 등록해야 크레딧 체크를 탄다."""

    # Agent
    SKILL_SELECTION = "skill_selection"
    AGENT_MESSAGE = "agent_message"
    PROFILE_ANALYZE = "profile_analyze"  # 무료(FREE_PURPOSES): 배경 프로필 정제, 기록만

    # Field Note — 무료 (STT/정제 + 녹음 중 AI 가이드)
    FIELD_NOTE_STT_CHUNK = "field_note_stt_chunk"
    FIELD_NOTE_STT_PLAIN = "field_note_stt_plain"
    FIELD_NOTE_STT_STREAMING = "field_note_stt_streaming"
    FIELD_NOTE_REFINE = "field_note_refine"
    FIELD_NOTE_RECOMMENDATION = "field_note_recommendation"

    # Field Note — 유료 (LLM + 온디맨드 화자분리)
    FIELD_NOTE_STT_DIARIZE = "field_note_stt_diarize"
    FIELD_NOTE_SUMMARIZE = "field_note_summarize"
    FIELD_NOTE_GENERATE_NOTE = "field_note_generate_note"

    # Counseling
    CASE_ANALYSIS = "case_analysis"
    COUNSELING_GUARDIAN_SHARE = "counseling_guardian_share"

    # Voucher Processing (Admin — 센터 크레딧 미차감)
    VOUCHER_PDF_TO_MD = "voucher_pdf_to_md"
    VOUCHER_MD_TO_JSON = "voucher_md_to_json"

    # Form (양식)
    FORM_GENERATE_DRAFT = "form_generate_draft"  # 무료(FREE_PURPOSES): 기록만, 미차감
    FORM_EXTRACT_SCHEMA = "form_extract_schema"  # Admin: 스캔 서식→스키마, center_id="" → 미차감


# ── 무료 purpose (크레딧 차감 없음) ──

FREE_PURPOSES: frozenset[str] = frozenset({
    AIPurpose.PROFILE_ANALYZE,
    AIPurpose.FIELD_NOTE_STT_CHUNK,
    AIPurpose.FIELD_NOTE_STT_PLAIN,
    AIPurpose.FIELD_NOTE_STT_STREAMING,
    AIPurpose.FIELD_NOTE_REFINE,
    AIPurpose.FIELD_NOTE_RECOMMENDATION,
    AIPurpose.FORM_GENERATE_DRAFT,
    # Admin 작업 — center_id="" 로만 호출, 센터 크레딧 미차감 (각 Enum 주석 참조)
    AIPurpose.VOUCHER_PDF_TO_MD,
    AIPurpose.VOUCHER_MD_TO_JSON,
    AIPurpose.FORM_EXTRACT_SCHEMA,
})

# ── 화자분리 과금: 오디오 길이 → 합성 토큰 환산 ──
# 화자분리는 토큰이 아니라 오디오 길이(분) 기준 작업이므로, 길이를 합성 토큰으로
# 환산해 기존 토큰 기반 차감 로직(DeductCreditService)을 재사용한다.
# 가격(분당 크레딧)은 제품 정책으로 결정 — env DIARIZE_TOKENS_PER_MINUTE로 조정.
DIARIZE_TOKENS_PER_MINUTE: int = int(os.getenv("DIARIZE_TOKENS_PER_MINUTE", "4000"))

# ── 기능별 예상 크레딧 소비량 (사전 체크용) ──
# 한국어 기준: 8,000자 트랜스크립트 입력 시 실측값 기반.
# gpt-4o-mini + cl200k_base 토크나이저에서 한글 1글자 ≈ 1.3~1.5 토큰.

# 사전 게이트(check_quota)용 대표값. 편차 큰 기능은 헤드룸을 얹어 소프트캡 오버슈트를 줄인다
# (실측 p95로 튜닝 대상 — deduct_credit soft-cap 주석 참조).
PURPOSE_ESTIMATED_CREDITS: dict[str, int] = {
    AIPurpose.SKILL_SELECTION: 3,            # Gemini Flash, 짧은 컨텍스트
    AIPurpose.AGENT_MESSAGE: 5,              # new_agent 멀티턴(잠정 — 미사용, p95로 튜닝)
    AIPurpose.FIELD_NOTE_STT_DIARIZE: 5,     # 사전 체크용 대표값(잔량 게이트). 실제 차감은 오디오 길이 기반
    AIPurpose.FIELD_NOTE_SUMMARIZE: 7,       # ~13K tokens (시스템+전사+메모 → 200자 요약)
    AIPurpose.FIELD_NOTE_GENERATE_NOTE: 8,   # ~16K tokens (시스템+전사+메모+요약 → JSON)
    AIPurpose.CASE_ANALYSIS: 14,             # ~21K tokens 종단분석, 대형 JSON — 헤드룸(11→14)로 오버슈트 완화
    AIPurpose.COUNSELING_GUARDIAN_SHARE: 3,  # ~5K tokens (시스템+일지 4필드 → 짧은 JSON)
}

# ── 한글 라벨 (UI 표시용) ──

PURPOSE_LABELS: dict[str, str] = {
    AIPurpose.SKILL_SELECTION: "AI 에이전트",
    AIPurpose.PROFILE_ANALYZE: "사용 프로필 분석",
    AIPurpose.FIELD_NOTE_STT_CHUNK: "음성 전사 (STT)",
    AIPurpose.FIELD_NOTE_STT_PLAIN: "음성 전사 (평문)",
    AIPurpose.FIELD_NOTE_STT_DIARIZE: "화자분리 전사",
    AIPurpose.FIELD_NOTE_STT_STREAMING: "실시간 음성 전사",
    AIPurpose.FIELD_NOTE_REFINE: "텍스트 정제",
    AIPurpose.FIELD_NOTE_SUMMARIZE: "상담 요약",
    AIPurpose.FIELD_NOTE_GENERATE_NOTE: "상담일지 생성",
    AIPurpose.FIELD_NOTE_RECOMMENDATION: "추천 생성",
    AIPurpose.CASE_ANALYSIS: "상담 사례분석",
    AIPurpose.COUNSELING_GUARDIAN_SHARE: "공유문 생성",
    AIPurpose.VOUCHER_PDF_TO_MD: "바우처 PDF 변환",
    AIPurpose.VOUCHER_MD_TO_JSON: "바우처 데이터 추출",
    AIPurpose.FORM_GENERATE_DRAFT: "AI 양식 생성",
    AIPurpose.FORM_EXTRACT_SCHEMA: "AI 양식 추출",
}

# ── 플랜별 크레딧 한도 (subscription 모듈이 단일 진실 공급원) ──

from app.modules.subscription.subscription.plan_config import PLAN_CREDIT_LIMITS  # noqa: E402, F401

# 1크레딧 = N 토큰
TOKENS_PER_CREDIT: int = int(os.getenv("CREDIT_TOKENS_PER_CREDIT", "2000"))
