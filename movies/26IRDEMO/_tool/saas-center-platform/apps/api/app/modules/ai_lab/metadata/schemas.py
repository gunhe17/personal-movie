"""AI Lab 메타데이터 빌더.

프론트엔드에서 사용하는 모듈/파이프라인/모델/실험유형 정보를 정적으로 제공.
DB 조회 없이 코드에 정의된 설정을 반환하며, 향후 DB 기반으로 확장 가능.
"""

from __future__ import annotations

from pydantic import BaseModel


class ModelOption(BaseModel):
    value: str
    label: str
    provider: str
    cost_label: str | None = None


class DiarizationStrategyMeta(BaseModel):
    key: str              # "integrated" | "specialized"
    label: str
    description: str
    models: list[ModelOption] = []


class PipelineStepMeta(BaseModel):
    key: str
    label: str
    description: str
    has_prompt: bool
    models: list[ModelOption] = []
    diarization_strategies: list[DiarizationStrategyMeta] | None = None


class ModuleMeta(BaseModel):
    key: str
    label: str
    pipeline_steps: list[PipelineStepMeta] = []


class ExperimentTypeMeta(BaseModel):
    key: str
    label: str
    category: str
    default_system_prompt: str | None = None
    input_placeholder: str | None = None
    instruction_placeholder: str | None = None


class LabMetadataResponse(BaseModel):
    modules: list[ModuleMeta]
    experiment_types: list[ExperimentTypeMeta]
    stt_models: list[ModelOption]
    stt_diarize_models: list[ModelOption]
    llm_models: list[ModelOption]
    purpose_labels: dict[str, str]

# ── 모델 목록 ──

# 단순 전사용 STT 모델 (화자분리 분리 전략에서도 공유)
STT_MODELS: list[ModelOption] = [
    ModelOption(value="gpt-4o-mini-transcribe", label="GPT-4o Mini · 저비용", provider="openai", cost_label="$0.003/분"),
    ModelOption(value="gpt-4o-transcribe", label="GPT-4o · 고품질", provider="openai", cost_label="$0.006/분"),
    ModelOption(value="whisper-1", label="Whisper-1 · 레거시", provider="openai", cost_label="$0.006/분"),
]

# 실시간 전사 전용 (5분 청크, Whisper만 사용)
REALTIME_STT_MODELS: list[ModelOption] = [
    ModelOption(value="whisper-1", label="Whisper-1", provider="openai", cost_label="$0.006/분"),
]

# 화자분리용 STT 모델 (통합 전략: gpt-4o-transcribe-diarize 전용 모델 + diarized_json)
STT_DIARIZE_MODELS: list[ModelOption] = [
    ModelOption(value="gpt-4o-transcribe-diarize", label="GPT-4o 화자분리 · 통합", provider="openai", cost_label="$0.006/분"),
]

# 화자분리 전용 모델 (분리 전략: STT 후 별도 화자분리)
DIARIZE_ONLY_MODELS: list[ModelOption] = [
    ModelOption(value="pyannote/speaker-diarization-3.1", label="pyannote 3.1 · 다화자 특화", provider="huggingface"),
]

# ── 화자분리 전략 정의 ──

DIARIZATION_STRATEGIES: list[DiarizationStrategyMeta] = [
    DiarizationStrategyMeta(
        key="integrated",
        label="통합 (OpenAI)",
        description="전사와 화자분리를 하나의 모델이 동시 수행. 2인 상담에 최적.",
        models=STT_DIARIZE_MODELS,
    ),
    DiarizationStrategyMeta(
        key="specialized",
        label="분리 (STT + pyannote)",
        description="전사(Whisper) → 화자분리(pyannote) → 정렬. 3인 이상 그룹 상담에 적합.",
        models=STT_MODELS + DIARIZE_ONLY_MODELS,
    ),
]

LLM_MODELS: list[ModelOption] = [
    ModelOption(value="gpt-4.1", label="GPT-4.1", provider="openai"),
    ModelOption(value="gpt-4.1-mini", label="GPT-4.1 Mini", provider="openai"),
    ModelOption(value="gpt-4.1-nano", label="GPT-4.1 Nano", provider="openai"),
    ModelOption(value="gpt-4o", label="GPT-4o", provider="openai"),
    ModelOption(value="gpt-4o-mini", label="GPT-4o Mini", provider="openai"),
]

# ── 스트리밍 STT 모델 (AWS Transcribe 등) ──

STREAMING_STT_MODELS: list[ModelOption] = [
    ModelOption(value="aws-transcribe-streaming", label="AWS Transcribe · 실시간", provider="aws", cost_label="$0.024/분"),
]

# ── Agent 모델 (OpenRouter 경유) ──

AGENT_MODELS: list[ModelOption] = [
    ModelOption(value="google/gemini-2.5-flash", label="Gemini 2.5 Flash", provider="openrouter"),
    ModelOption(value="google/gemini-2.0-flash-lite-001", label="Gemini 2.0 Flash Lite", provider="openrouter"),
    ModelOption(value="gpt-4.1-mini", label="GPT-4.1 Mini", provider="openai"),
    ModelOption(value="gpt-4.1-nano", label="GPT-4.1 Nano", provider="openai"),
]

# ── Voucher 모델 (OpenRouter 멀티모달) ──

VOUCHER_MODELS: list[ModelOption] = [
    ModelOption(value="google/gemini-2.5-flash", label="Gemini 2.5 Flash", provider="openrouter"),
    ModelOption(value="google/gemini-2.0-flash-001", label="Gemini 2.0 Flash", provider="openrouter"),
    ModelOption(value="openai/gpt-4o", label="GPT-4o", provider="openrouter"),
]

# ── 모듈별 파이프라인 정의 ──

MODULE_DEFINITIONS: list[ModuleMeta] = [
    ModuleMeta(
        key="field_note",
        label="필드노트",
        pipeline_steps=[
            # ── 실시간 (5분 단위) ──
            PipelineStepMeta(
                key="stt_transcribe",
                label="청크 전사",
                description="N분 청크 단위 STT 전사 (Whisper / GPT-4o 선택 가능)",
                has_prompt=False,
                models=STT_MODELS,
            ),
            PipelineStepMeta(
                key="stt_streaming",
                label="실시간 스트리밍 전사",
                description="AWS Transcribe 기반 실시간 스트리밍 STT",
                has_prompt=False,
                models=STREAMING_STT_MODELS,
            ),
            PipelineStepMeta(
                key="recommendation",
                label="AI 상담 추천",
                description="실시간 전사 기반 상담 방향 제안",
                has_prompt=True,
                models=LLM_MODELS,
            ),
            # ── 녹음 완료 후 ──
            PipelineStepMeta(
                key="stt_diarize",
                label="화자분리 (음향)",
                description="오디오 기반 화자분리 (gpt-4o-transcribe-diarize). 텍스트 분리 비교용 레퍼런스.",
                has_prompt=False,
                models=STT_DIARIZE_MODELS,
            ),
            PipelineStepMeta(
                key="stt_text_diarize",
                label="화자분리 (텍스트·실험)",
                description="오디오 없이 whisper-1 전사 → LLM이 발화 내용으로 화자 추론. 음향 분리와 A/B 비교용.",
                has_prompt=False,
                models=LLM_MODELS,
            ),
            PipelineStepMeta(
                key="stt_aws_text_diarize",
                label="화자분리 (AWS전사·실험)",
                description="AWS 실시간 전사를 그대로 두고 LLM이 화자만 분리. 전사 재전사 없음(녹음 중 자막과 일치). 재생 싱크 검증용.",
                has_prompt=False,
                models=LLM_MODELS,
            ),
            PipelineStepMeta(
                key="chain_stt_refine",
                label="화자분리 + 보정",
                description="STT 화자분리 → LLM 보정 한번에 실행 (프로덕션 동일)",
                has_prompt=True,
                models=LLM_MODELS,
                diarization_strategies=DIARIZATION_STRATEGIES,
            ),
            PipelineStepMeta(
                key="refine",
                label="전사 보정",
                description="STT 결과를 자연스러운 문장으로 보정 (프롬프트 튜닝용)",
                has_prompt=True,
                models=LLM_MODELS,
            ),
            PipelineStepMeta(
                key="summary",
                label="AI 요약",
                description="보정된 전사 기반 핵심 요약",
                has_prompt=True,
                models=LLM_MODELS,
            ),
            PipelineStepMeta(
                key="counseling_note",
                label="상담일지",
                description="구조화된 상담일지 생성",
                has_prompt=True,
                models=LLM_MODELS,
            ),
        ],
    ),
    ModuleMeta(
        key="counseling",
        label="상담",
        pipeline_steps=[
            PipelineStepMeta(
                key="case_analysis",
                label="사례 분석",
                description="여러 회기에 걸친 상담 기록의 종단적 분석",
                has_prompt=True,
                models=LLM_MODELS,
            ),
        ],
    ),
    ModuleMeta(
        key="agent",
        label="AI 에이전트",
        pipeline_steps=[
            PipelineStepMeta(
                key="skill_selection",
                label="스킬 선택",
                description="사용자 메시지를 분석하여 적절한 스킬을 선택하는 LLM 라우팅",
                has_prompt=False,
                models=AGENT_MODELS,
            ),
        ],
    ),
    ModuleMeta(
        key="platform_admin",
        label="플랫폼 관리",
        pipeline_steps=[
            PipelineStepMeta(
                key="voucher_pdf_to_md",
                label="바우처 PDF 변환",
                description="바우처 문서를 마크다운으로 변환 (image-to-md: CV whiteout + whole_page)",
                has_prompt=True,
                models=VOUCHER_MODELS,
            ),
            PipelineStepMeta(
                key="voucher_md_to_json",
                label="바우처 데이터 추출",
                description="마크다운에서 바우처 데이터를 JSON으로 추출",
                has_prompt=True,
                models=VOUCHER_MODELS,
            ),
        ],
    ),
]

# ── 실험 유형 ──

# field_note 프로덕션 프롬프트는 크로스 모듈 — application handler가 주입(fn_prompts).
from app.modules.counseling.counseling_case_analysis.prompts import CASE_ANALYSIS_SYSTEM_PROMPT
from app.modules.ai_lab.experiment_run.prompts import TEXT_DIARIZE_SYSTEM_PROMPT


def build_experiment_types(fn_prompts: dict[str, dict[str, str]]) -> list[ExperimentTypeMeta]:
    _FN = fn_prompts
    return [
    # ── 프로덕션 파이프라인 매칭 실험 유형 ──
    ExperimentTypeMeta(
        key="stt_transcribe",
        label="청크 전사",
        category="stt",
    ),
    ExperimentTypeMeta(
        key="chain_stt_refine",
        label="화자분리 전사",
        category="chain",
        default_system_prompt=_FN.get("refine", {}).get("system_prompt"),
    ),
    ExperimentTypeMeta(
        key="stt_diarize",
        label="화자분리 (음향)",
        category="stt",  # 음향 기반 — 프롬프트 없음
    ),
    ExperimentTypeMeta(
        key="stt_text_diarize",
        label="화자분리 (텍스트·실험)",
        category="stt",  # 오디오 입력이지만 화자 추론 프롬프트를 튜닝 가능
        default_system_prompt=TEXT_DIARIZE_SYSTEM_PROMPT,
    ),
    ExperimentTypeMeta(
        key="stt_aws_text_diarize",
        label="화자분리 (AWS전사·실험)",
        category="stt",  # AWS 실시간 전사 재사용 + LLM 화자 라벨
        default_system_prompt=TEXT_DIARIZE_SYSTEM_PROMPT,
    ),
    ExperimentTypeMeta(
        key="llm_summary",
        label="AI 요약",
        category="llm",
        default_system_prompt=_FN.get("summary", {}).get("system_prompt"),
        input_placeholder=(
            "요약할 상담 녹취록이나 텍스트를 붙여넣으세요.\n\n"
            "예시:\n"
            "상담사: 오늘은 어떤 이야기를 하고 싶으세요?\n"
            "내담자: 요즘 직장에서 스트레스를 많이 받아서..."
        ),
        instruction_placeholder=(
            "다음 상담 녹취를 핵심 내용 3줄로 요약해주세요.\n\n{input}"
        ),
    ),
    ExperimentTypeMeta(
        key="llm_counseling_note",
        label="상담일지",
        category="llm",
        default_system_prompt=_FN.get("counseling_note", {}).get("system_prompt"),
        input_placeholder=(
            "상담일지를 생성할 녹취록과 메모를 붙여넣으세요.\n\n"
            "예시:\n"
            "상담사: 지난 주에 과제는 해보셨나요?\n"
            "내담자: 네, 감정일기를 써봤는데..."
        ),
        instruction_placeholder=(
            "다음 상담 내용을 바탕으로 SOAP 형식의 상담일지를 작성해주세요.\n\n{input}"
        ),
    ),
    ExperimentTypeMeta(
        key="llm_recommendation",
        label="AI 상담 추천",
        category="llm",
        default_system_prompt=_FN.get("recommendation", {}).get("system_prompt"),
        input_placeholder=(
            "현재 상담 세션의 전사 내용이나 메모를 붙여넣으세요.\n\n"
            "예시:\n"
            "내담자가 최근 수면 어려움과 불안 증상을 호소하고 있으며,\n"
            "직장 내 대인관계 갈등이 주요 스트레스 요인으로 보임."
        ),
        instruction_placeholder=(
            "현재 상담 맥락을 분석하여 상담사에게 추천 질문과 기법을 제공해주세요.\n\n{input}"
        ),
    ),
    ExperimentTypeMeta(
        key="llm_refine",
        label="전사 보정",
        category="llm",
        default_system_prompt=_FN.get("refine", {}).get("system_prompt"),
        input_placeholder=(
            "STT 전사 결과를 붙여넣으세요.\n\n"
            "■ 평문: 어 그래서 요즘에 좀 힘들었어요 네 맞아요...\n"
            "■ 화자분리: [1] A: 어 그래서 요즘에 좀 힘들었어요"
        ),
        instruction_placeholder=(
            "아래 STT 결과의 오탈자를 수정하고 자연스럽게 다듬어주세요.\n\n{input}"
        ),
    ),
    ExperimentTypeMeta(
        key="stt_streaming",
        label="실시간 스트리밍 전사",
        category="stt",
    ),
    ExperimentTypeMeta(
        key="llm_case_analysis",
        label="사례 분석",
        category="llm",
        default_system_prompt=CASE_ANALYSIS_SYSTEM_PROMPT,
        input_placeholder=(
            "분석할 상담 케이스의 회기 기록을 붙여넣으세요.\n\n"
            "예시:\n"
            "[1회기] 주호소: 직장 내 대인관계 갈등...\n"
            "[2회기] 이전 회기 이후 변화 탐색..."
        ),
        instruction_placeholder=(
            "다음 상담 케이스의 여러 회기 기록을 분석하여 종단적 분석 결과를 JSON으로 제공해주세요.\n\n{input}"
        ),
    ),
    # ── Agent ──
    ExperimentTypeMeta(
        key="agent_skill_selection",
        label="에이전트 스킬 선택",
        category="llm",
        input_placeholder=(
            "에이전트에게 보낼 메시지를 입력하세요.\n\n"
            "예시:\n"
            "다음 주 월요일 오전 10시에 김철수 내담자 상담 예약해줘"
        ),
        instruction_placeholder=(
            "사용자 메시지를 분석하여 적절한 스킬을 선택해주세요.\n\n{input}"
        ),
    ),
    # ── Voucher (Admin) ──
    ExperimentTypeMeta(
        key="voucher_pdf_to_md",
        label="바우처 PDF 변환",
        category="llm",
        input_placeholder="바우처 PDF 파일 내용 (이미지 기반 멀티모달 처리)",
    ),
    ExperimentTypeMeta(
        key="voucher_md_to_json",
        label="바우처 데이터 추출",
        category="llm",
        input_placeholder="바우처 마크다운 텍스트를 입력하세요.",
        instruction_placeholder=(
            "마크다운에서 바우처 정보를 추출하여 JSON으로 변환해주세요.\n\n{input}"
        ),
    ),
    # ── 하위 호환: 기존 실험 기록 조회용 (파이프라인에서는 제외) ──
    ExperimentTypeMeta(key="stt_diarize", label="STT 화자분리 (raw)", category="stt"),
]

# ── Purpose 라벨 (프로덕션 비용 추적) ──

PURPOSE_LABELS: dict[str, str] = {
    "stt_transcribe": "청크 전사",
    "stt_diarize": "화자분리 전사",
    "stt_streaming": "실시간 스트리밍 전사",
    "refine": "전사 보정",
    "summary": "AI 요약",
    "counseling_note": "상담일지 생성",
    "recommendation": "AI 상담 추천",
    "case_analysis": "사례 분석",
    "skill_selection": "에이전트 스킬 선택",
    "voucher_pdf_to_md": "바우처 PDF 변환",
    "voucher_md_to_json": "바우처 데이터 추출",
}


def build_lab_metadata(
    fn_prompts: dict[str, dict[str, str]],
) -> LabMetadataResponse:
    """AI Lab 메타데이터를 빌드하여 반환.

    fn_prompts: field_note 프로덕션 프롬프트(크로스 모듈) — handler가 주입.
    """
    return LabMetadataResponse(
        modules=MODULE_DEFINITIONS,
        experiment_types=build_experiment_types(fn_prompts),
        stt_models=STT_MODELS,
        stt_diarize_models=STT_DIARIZE_MODELS,
        llm_models=LLM_MODELS,
        purpose_labels=PURPOSE_LABELS,
    )
