from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class STTExperimentRequest(BaseModel):
    experiment_type: str = "stt_diarize"  # stt_transcribe | stt_diarize | stt_text_diarize
    sample_id: str
    model_name: str = "gpt-4o-transcribe-diarize"
    provider: str = "openai"
    model_params: dict[str, Any] | None = None
    system_prompt: str | None = None  # stt_text_diarize 전용: 화자 추론 프롬프트(없으면 기본값)
    tags: str | None = None
    memo: str | None = None


class TextDiarizeEvalSegment(BaseModel):
    speaker: str
    text: str
    start: float = 0.0
    end: float = 0.0


class TextDiarizeEvalInputSegment(BaseModel):
    text: str
    start: float = 0.0
    end: float = 0.0


class TextDiarizeEvalRequest(BaseModel):
    segments: list[TextDiarizeEvalSegment]  # 정답(클로바 등) 전사 — 화자 라벨 포함
    # 원본(화자분리 안 된 실제 전사). 주어지면 이걸 LLM에 돌려 정답과 시간 기반 비교.
    # 비우면 정답에서 화자만 떼어 입력으로 사용(세그먼트 동일 = 이상적 입력).
    input_segments: list[TextDiarizeEvalInputSegment] | None = None
    # 침묵 간격 병합 임계값(초). >0 이면 라벨링 전 파편을 턴 단위로 병합(원본 모드 전용). 0=병합 안 함.
    merge_gap: float = 0.0
    model_name: str = "gpt-4.1"
    provider: str = "openai"
    system_prompt: str | None = None  # 화자 추론 프롬프트(없으면 기본값)


class TextDiarizeEvalPerSegment(BaseModel):
    idx: int
    text: str
    start: float
    ref_speaker: str
    pred_speaker: str
    mapped_pred: str
    correct: bool


class TextDiarizeEvalResponse(BaseModel):
    accuracy_pct: float
    correct: int
    total: int
    label_mapping: dict[str, str]
    ref_speaker_count: int
    pred_speaker_count: int
    # 임밸런스 보정 지표 — 다수 화자 baseline 대비/소수 화자 recall/균형 정확도
    majority_baseline_pct: float = 0.0
    balanced_accuracy_pct: float = 0.0
    per_speaker_recall: dict[str, float] = {}
    # 침묵 병합 전/후 발화 수 (727 → N)
    input_count: int = 0
    merged_count: int = 0
    latency_ms: int
    per_segment: list[TextDiarizeEvalPerSegment]


class LLMExperimentRequest(BaseModel):
    experiment_type: str = "llm_summary"
    sample_id: str | None = None
    input_text: str | None = None
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    model_name: str = "gpt-4.1"
    provider: str = "openai"
    prompt_version_id: str | None = None
    model_params: dict[str, Any] | None = None
    tags: str | None = None
    memo: str | None = None

    @model_validator(mode="after")
    def validate_input_source(self) -> "LLMExperimentRequest":
        if not self.sample_id and not self.input_text:
            raise ValueError("sample_id 또는 input_text 중 하나는 반드시 제공해야 합니다.")
        return self


class ExperimentRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    experiment_type: str
    field_note_id: str | None = None
    field_note_audio_id: str | None = None
    sample_id: str | None = None
    provider: str
    model_name: str
    model_params: str | None = None
    prompt_version_id: str | None = None
    author_id: str | None = None
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    latency_ms: int | None = None
    error_message: str | None = None
    input_text: str | None = None
    input_audio_duration: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    estimated_cost_usd: float | None = None
    output_text: str | None = None
    output_json: str | None = None
    tags: str | None = None
    memo: str | None = None
    quality_score: int | None = None
    quality_note: str | None = None
    created_at: datetime
    updated_at: datetime


class ExperimentEvaluationUpdate(BaseModel):
    quality_score: int = Field(ge=1, le=5)
    quality_note: str | None = None


class SpeakerConfusion(BaseModel):
    predicted: str  # 결과가 배정한(정답 라벨 공간으로 매핑된) 화자
    correct: str    # 실제 정답 화자
    count: int      # 혼동 발생 발화 수


class DiarizationAccuracyResponse(BaseModel):
    accuracy_pct: float
    matched_ticks: int
    total_ticks: int
    ref_speakers: int
    cand_speakers: int
    label_mapping: dict[str, str]
    segment_correct: list[bool]
    confusion: list[SpeakerConfusion] = []


class PromptSuggestionResponse(BaseModel):
    suggestion: str
    mismatch_count: int
    accuracy_pct: float


class ExperimentRunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    experiment_type: str
    sample_id: str | None = None
    model_name: str
    status: str
    latency_ms: int | None = None
    estimated_cost_usd: float | None = None
    output_text: str | None = None
    quality_score: int | None = None
    created_at: datetime


class ExperimentRunListResponse(BaseModel):
    items: list[ExperimentRunSummary]
    total: int
    page: int
    size: int
    pages: int


class ProductionCostByPurpose(BaseModel):
    purpose: str | None = None
    model: str | None = None
    calls: int
    input_tokens: int
    output_tokens: int
    audio_seconds: float
    estimated_cost_usd: float


class ProductionCostSummary(BaseModel):
    total_calls: int
    total_input_tokens: int
    total_output_tokens: int
    total_audio_seconds: float
    estimated_cost_usd: float
    by_purpose: list[ProductionCostByPurpose]


class LabCostByType(BaseModel):
    type: str
    runs: int
    cost_usd: float
    avg_latency_ms: float | None = None


class LabCostSummary(BaseModel):
    total_runs: int
    total_input_tokens: int
    total_output_tokens: int
    total_audio_seconds: float
    estimated_cost_usd: float
    by_type: list[LabCostByType]


class CostSummaryResponse(BaseModel):
    production: ProductionCostSummary
    lab: LabCostSummary


class ChainExperimentRequest(BaseModel):
    sample_id: str
    stt_model_name: str = "gpt-4o-transcribe-diarize"
    llm_model_name: str = "gpt-4.1"
    provider: str = "openai"
    system_prompt: str | None = None
    model_params: dict[str, Any] | None = None
    tags: str | None = None
    memo: str | None = None


class PlaygroundRunRequest(BaseModel):
    experiment_type: str = Field(min_length=1)
    sample_id: str | None = None
    input_text: str | None = None
    model_name: str
    provider: str = "openai"
    prompt_version_id: str | None = None
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    model_params: dict[str, Any] | None = None
    save_result: bool = False

    @model_validator(mode="after")
    def validate_input_source(self) -> "PlaygroundRunRequest":
        if self.experiment_type.startswith("llm"):
            if not self.sample_id and not self.input_text:
                raise ValueError("LLM 실험은 sample_id 또는 input_text가 필요합니다.")
        elif self.experiment_type.startswith("stt"):
            if not self.sample_id:
                raise ValueError("STT 실험은 sample_id가 필요합니다.")
        return self
