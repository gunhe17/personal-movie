/**
 * AI Lab Actions
 * 내부 도구용 API action 함수들 (STT/LLM 실험, 프롬프트 관리, 비용 추적)
 *
 * 모든 요청은 instances (baseURL /api/proxy)를 통해 프록시됨
 * 백엔드 prefix: /internal/ai-lab
 */

import { appInstance, get, post, patch, deleteResource } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

const BASE = '/internal/ai-lab'

// ============ 프롬프트 Types ============

export interface PromptVersionResponse {
  id: string
  prompt_key: string
  version: number
  name: string
  system_prompt: string
  user_prompt_template: string | null
  author_id: string | null
  is_active: boolean
  is_production: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export interface PromptVersionCreateParams {
  prompt_key: string
  name: string
  system_prompt: string
  user_prompt_template?: string | null
  description?: string | null
}

export interface PromptVersionUpdateParams {
  promptId: string
  name?: string
  system_prompt?: string
  user_prompt_template?: string | null
  is_active?: boolean
  description?: string | null
}

// ============ 실험 Types ============

export interface ExperimentRunResponse {
  id: string
  experiment_type: string
  sample_id: string | null
  provider: string
  model_name: string
  model_params: string | null
  prompt_version_id: string | null
  author_id: string | null
  status: string
  started_at: string | null
  completed_at: string | null
  latency_ms: number | null
  error_message: string | null
  input_text: string | null
  input_audio_duration: number | null
  input_tokens: number | null
  output_tokens: number | null
  total_tokens: number | null
  estimated_cost_usd: number | null
  output_text: string | null
  output_json: string | null
  tags: string | null
  memo: string | null
  quality_score: number | null
  quality_note: string | null
  created_at: string
  updated_at: string
}

export interface ExperimentRunSummary {
  id: string
  experiment_type: string
  sample_id: string | null
  model_name: string
  status: string
  latency_ms: number | null
  estimated_cost_usd: number | null
  output_text: string | null
  quality_score: number | null
  created_at: string
}

export interface ExperimentListResponse {
  items: ExperimentRunSummary[]
  total: number
  page: number
  size: number
}

export interface STTExperimentParams {
  experiment_type?: string  // stt_transcribe | stt_diarize | stt_text_diarize
  sample_id: string
  model_name?: string
  provider?: string
  model_params?: Record<string, unknown> | null
  system_prompt?: string | null  // stt_text_diarize 전용: 화자 추론 프롬프트
  tags?: string | null
  memo?: string | null
}

export interface LLMExperimentParams {
  experiment_type: string
  sample_id?: string | null
  input_text?: string | null
  system_prompt?: string | null
  user_prompt_template?: string | null
  model_name?: string
  provider?: string
  prompt_version_id?: string | null
  model_params?: Record<string, unknown> | null
  tags?: string | null
  memo?: string | null
}

export interface ChainExperimentParams {
  sample_id: string
  stt_model_name?: string
  llm_model_name?: string
  provider?: string
  system_prompt?: string | null
  model_params?: Record<string, unknown> | null
  tags?: string | null
  memo?: string | null
}

// ============ 샘플 데이터셋 Types ============

export interface SampleDatasetResponse {
  id: string
  name: string
  description: string | null
  input_type: 'text' | 'audio'
  text_content: string | null
  s3_key: string | null
  audio_duration: number | null
  audio_file_size: number | null
  tags: string | null
  source_type: string | null
  field_note_id?: string | null
  reference_segments?: string | null
  author_id: string | null
  usage_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface SampleDatasetSummary {
  id: string
  name: string
  input_type: 'text' | 'audio'
  tags: string | null
  usage_count: number
  last_used_at: string | null
  created_at: string
}

export interface SampleListResponse {
  items: SampleDatasetSummary[]
  total: number
  page: number
  size: number
}

export interface GetSampleListParams {
  input_type?: string
  tags?: string
  page?: number
  size?: number
}

export interface SampleAudioUrlResponse {
  download_url: string
  expires_in: number
  sample_id: string
  audio_duration: number | null
  audio_file_size: number | null
}

// ============ 비용 Types ============

export interface CostByPurpose {
  purpose: string
  model: string
  calls: number
  input_tokens: number
  output_tokens: number
  audio_seconds: number
  estimated_cost_usd: number
}

export interface ProductionCostSummary {
  total_calls: number
  total_input_tokens: number
  total_output_tokens: number
  total_audio_seconds: number
  estimated_cost_usd: number
  by_purpose: CostByPurpose[]
}

export interface CostByType {
  type: string
  runs: number
  cost_usd: number
  avg_latency_ms: number | null
}

export interface LabCostSummary {
  total_runs: number
  total_input_tokens: number
  total_output_tokens: number
  total_audio_seconds: number
  estimated_cost_usd: number
  by_type: CostByType[]
}

export interface CostSummaryResponse {
  production: ProductionCostSummary
  lab: LabCostSummary
}

// ============ Query Params ============

export interface GetExperimentListParams {
  experiment_type?: string
  experiment_type_prefix?: string
  sample_id?: string
  status?: string
  page?: number
  size?: number
}

export interface GetCostSummaryParams {
  date_from?: string
  date_to?: string
}

// ============ 프롬프트 관리 Actions ============

export const getLabPromptList = (): Action<
  PromptVersionResponse[],
  PromptVersionResponse[]
> => ({
  key: ['getLabPromptList'],
  request: async (params: { prompt_key?: string } = {}): Promise<PromptVersionResponse[]> => {
    const query: Record<string, string | undefined> = {}
    if (params.prompt_key) query.prompt_key = params.prompt_key
    return get<PromptVersionResponse[]>(`${BASE}/prompts`, query)
  }
})

export const getLabPromptDetail = (): Action<
  PromptVersionResponse,
  PromptVersionResponse
> => ({
  key: ['getLabPromptDetail'],
  request: async (params: { promptId: string }): Promise<PromptVersionResponse> => {
    return get<PromptVersionResponse>(`${BASE}/prompts/${params.promptId}`)
  }
})

export const createLabPrompt = () => ({
  key: ['createLabPrompt', 'getLabPromptList'],
  request: async (params: PromptVersionCreateParams): Promise<PromptVersionResponse> => {
    const res = await post<PromptVersionResponse>(`${BASE}/prompts`, params)
    return (
      (res as { data?: PromptVersionResponse }).data ??
      (res as unknown as PromptVersionResponse)
    )
  }
})

export const updateLabPrompt = () => ({
  key: ['updateLabPrompt', 'getLabPromptList', 'getLabPromptDetail'],
  request: async (params: PromptVersionUpdateParams): Promise<PromptVersionResponse> => {
    const { promptId, ...body } = params
    const res = await patch<PromptVersionResponse>(`${BASE}/prompts/${promptId}`, body)
    return (
      (res as { data?: PromptVersionResponse }).data ??
      (res as unknown as PromptVersionResponse)
    )
  }
})

export const deleteLabPrompt = () => ({
  key: ['deleteLabPrompt', 'getLabPromptList'],
  request: async (params: { promptId: string }): Promise<void> => {
    await deleteResource(`${BASE}/prompts/${params.promptId}`)
  }
})

export const importProductionPrompts = () => ({
  key: ['importProductionPrompts', 'getLabPromptList'],
  request: async (): Promise<PromptVersionResponse[]> => {
    const res = await post<PromptVersionResponse[]>(`${BASE}/prompts/import-production`, {})
    return (
      (res as { data?: PromptVersionResponse[] }).data ??
      (res as unknown as PromptVersionResponse[])
    )
  }
})

// ============ 실험 실행 Actions ============

export const runSTTExperiment = () => ({
  key: ['runSTTExperiment', 'getLabExperimentList'],
  request: async (params: STTExperimentParams): Promise<ExperimentRunResponse> => {
    const res = await appInstance.post<ExperimentRunResponse>(
      `${BASE}/experiments/stt`,
      params,
      { timeout: 180_000 },
    )
    return res.data
  }
})

export const runLLMExperiment = () => ({
  key: ['runLLMExperiment', 'getLabExperimentList'],
  request: async (params: LLMExperimentParams): Promise<ExperimentRunResponse> => {
    const res = await appInstance.post<ExperimentRunResponse>(
      `${BASE}/experiments/llm`,
      params,
      { timeout: 120_000 },
    )
    return res.data
  }
})

export const runChainExperiment = () => ({
  key: ['runChainExperiment', 'getLabExperimentList'],
  request: async (params: ChainExperimentParams): Promise<ExperimentRunResponse> => {
    const res = await appInstance.post<ExperimentRunResponse>(
      `${BASE}/experiments/chain`,
      params,
      { timeout: 300_000 },
    )
    return res.data
  }
})

// ============ 정답 기반 텍스트 화자분리 평가 (프롬프트 튜닝) ============

export interface TextDiarizeEvalSegmentInput {
  speaker: string
  text: string
  start?: number
  end?: number
}

export interface TextDiarizeEvalRawSegment {
  text: string
  start?: number
  end?: number
}

export interface TextDiarizeEvalParams {
  segments: TextDiarizeEvalSegmentInput[]
  /** 원본(화자분리 안 된 실제 전사). 주어지면 이걸 LLM에 돌려 정답과 시간 기반 비교 */
  input_segments?: TextDiarizeEvalRawSegment[]
  /** 침묵 간격 병합 임계값(초). >0이면 라벨링 전 파편을 턴 단위로 병합(원본 모드). 0=병합 안 함 */
  merge_gap?: number
  model_name: string
  provider?: string
  system_prompt?: string | null
}

export interface TextDiarizeEvalPerSegment {
  idx: number
  text: string
  start: number
  ref_speaker: string
  pred_speaker: string
  mapped_pred: string
  correct: boolean
}

export interface TextDiarizeEvalResponse {
  accuracy_pct: number
  correct: number
  total: number
  label_mapping: Record<string, string>
  ref_speaker_count: number
  pred_speaker_count: number
  majority_baseline_pct: number
  balanced_accuracy_pct: number
  per_speaker_recall: Record<string, number>
  input_count: number
  merged_count: number
  latency_ms: number
  per_segment: TextDiarizeEvalPerSegment[]
}

export const runTextDiarizeEval = () => ({
  key: ['runTextDiarizeEval'],
  request: async (params: TextDiarizeEvalParams): Promise<TextDiarizeEvalResponse> => {
    const res = await appInstance.post<TextDiarizeEvalResponse>(
      `${BASE}/experiments/text-diarize-eval`,
      params,
      { timeout: 120_000 },
    )
    return res.data
  }
})

// ============ 실험 조회 Actions ============

export const getLabExperimentList = (): Action<
  ExperimentListResponse,
  ExperimentListResponse
> => ({
  key: ['getLabExperimentList'],
  request: async (params: GetExperimentListParams = {}): Promise<ExperimentListResponse> => {
    const query: Record<string, string | number | undefined> = {}
    if (params.experiment_type) query.experiment_type = params.experiment_type
    if (params.experiment_type_prefix) query.experiment_type_prefix = params.experiment_type_prefix
    if (params.sample_id) query.sample_id = params.sample_id
    if (params.status) query.status = params.status
    if (params.page !== undefined) query.page = params.page
    if (params.size !== undefined) query.size = params.size
    return get<ExperimentListResponse>(`${BASE}/experiments`, query)
  }
})

export const getLabExperimentDetail = (): Action<
  ExperimentRunResponse,
  ExperimentRunResponse
> => ({
  key: ['getLabExperimentDetail'],
  request: async (params: { experimentId: string }): Promise<ExperimentRunResponse> => {
    return get<ExperimentRunResponse>(`${BASE}/experiments/${params.experimentId}`)
  }
})

export const deleteLabExperiment = () => ({
  key: ['deleteLabExperiment', 'getLabExperimentList'],
  request: async (params: { experimentId: string }): Promise<void> => {
    await deleteResource(`${BASE}/experiments/${params.experimentId}`)
  }
})

export const evaluateExperiment = () => ({
  key: ['evaluateExperiment', 'getLabExperimentList', 'getLabExperimentDetail'],
  request: async (params: {
    experimentId: string
    quality_score: number
    quality_note?: string | null
  }): Promise<ExperimentRunResponse> => {
    const { experimentId, ...body } = params
    const res = await patch<ExperimentRunResponse>(
      `${BASE}/experiments/${experimentId}/evaluation`,
      body
    )
    return (
      (res as { data?: ExperimentRunResponse }).data ??
      (res as unknown as ExperimentRunResponse)
    )
  }
})

// ============ 샘플 데이터셋 Actions ============

export const getSampleList = (): Action<SampleListResponse, SampleListResponse> => ({
  key: ['getSampleList'],
  request: async (params: GetSampleListParams = {}): Promise<SampleListResponse> => {
    const query: Record<string, string | number | undefined> = {}
    if (params.input_type) query.input_type = params.input_type
    if (params.tags) query.tags = params.tags
    if (params.page !== undefined) query.page = params.page
    if (params.size !== undefined) query.size = params.size
    return get<SampleListResponse>(`${BASE}/samples`, query)
  }
})

export const getSampleDetail = (): Action<SampleDatasetResponse, SampleDatasetResponse> => ({
  key: ['getSampleDetail'],
  request: async (params: { sampleId: string }): Promise<SampleDatasetResponse> => {
    return get<SampleDatasetResponse>(`${BASE}/samples/${params.sampleId}`)
  }
})

export const getSampleAudioUrl = (): Action<
  SampleAudioUrlResponse,
  SampleAudioUrlResponse
> => ({
  key: ['getSampleAudioUrl'],
  request: async (params: { sampleId: string; expires_in?: number }): Promise<SampleAudioUrlResponse> => {
    const query: Record<string, number | undefined> = {}
    if (params.expires_in) query.expires_in = params.expires_in
    return get<SampleAudioUrlResponse>(`${BASE}/samples/${params.sampleId}/audio-url`, query)
  }
})

export const deleteSample = () => ({
  key: ['deleteSample', 'getSampleList'],
  request: async (params: { sampleId: string }): Promise<void> => {
    await deleteResource(`${BASE}/samples/${params.sampleId}`)
  }
})

// 단건 실험 상세 조회 (output_json 포함 — 히스토리에서 결과뷰로 불러올 때 사용)
export const getExperiment = (): Action<
  ExperimentRunResponse,
  ExperimentRunResponse
> => ({
  key: ['getExperiment'],
  request: async (params: { experimentId: string }): Promise<ExperimentRunResponse> => {
    return get<ExperimentRunResponse>(`${BASE}/experiments/${params.experimentId}`)
  }
})

// ============ 필드노트에서 샘플 가져오기 ============

export interface FieldNoteCandidate {
  field_note_id: string
  chunk_count: number
  duration: number
  transcribe_status: string | null
  diarization_status: string | null
  created_at: string
  already_imported: boolean
}

export interface FieldNoteCandidateListResponse {
  items: FieldNoteCandidate[]
}

export const getFieldNoteCandidates = (): Action<
  FieldNoteCandidateListResponse,
  FieldNoteCandidateListResponse
> => ({
  key: ['getFieldNoteCandidates'],
  request: async (params: { limit?: number } = {}): Promise<FieldNoteCandidateListResponse> => {
    const query: Record<string, number | undefined> = {}
    if (params.limit) query.limit = params.limit
    return get<FieldNoteCandidateListResponse>(`${BASE}/samples/field-note-candidates`, query)
  }
})

export const importFieldNoteSample = (): Action<
  SampleDatasetResponse,
  SampleDatasetResponse
> => ({
  key: ['importFieldNoteSample', 'getSampleList'],
  request: async (params: { field_note_id: string; name?: string }): Promise<SampleDatasetResponse> => {
    const res = await appInstance.post<SampleDatasetResponse>(`${BASE}/samples/from-field-note`, params)
    return res.data
  }
})

// ============ 화자분리 정답(reference) + 정확도 ============

export interface ReferenceSegment {
  speaker: string
  text: string
  start: number
  end: number
}

export interface SpeakerConfusion {
  predicted: string
  correct: string
  count: number
}

export interface DiarizationAccuracyResponse {
  accuracy_pct: number
  matched_ticks: number
  total_ticks: number
  ref_speakers: number
  cand_speakers: number
  label_mapping: Record<string, string>
  segment_correct: boolean[]
  confusion: SpeakerConfusion[]
}

export const setSampleReference = (): Action<SampleDatasetResponse, SampleDatasetResponse> => ({
  key: ['setSampleReference', 'getSampleList'],
  request: async (params: { sampleId: string; segments: ReferenceSegment[] }): Promise<SampleDatasetResponse> => {
    const res = await appInstance.put<SampleDatasetResponse>(
      `${BASE}/samples/${params.sampleId}/reference`,
      { segments: params.segments },
    )
    return res.data
  }
})

export const getDiarizationAccuracy = (): Action<
  DiarizationAccuracyResponse,
  DiarizationAccuracyResponse
> => ({
  key: ['getDiarizationAccuracy'],
  request: async (params: { experimentId: string }): Promise<DiarizationAccuracyResponse> => {
    const res = await appInstance.post<DiarizationAccuracyResponse>(
      `${BASE}/experiments/${params.experimentId}/accuracy`,
      {},
    )
    return res.data
  }
})

export interface PromptSuggestionResponse {
  suggestion: string
  mismatch_count: number
  accuracy_pct: number
}

export const getPromptSuggestion = (): Action<
  PromptSuggestionResponse,
  PromptSuggestionResponse
> => ({
  key: ['getPromptSuggestion'],
  request: async (params: { experimentId: string; model?: string }): Promise<PromptSuggestionResponse> => {
    const q = params.model ? `?model=${encodeURIComponent(params.model)}` : ''
    const res = await appInstance.post<PromptSuggestionResponse>(
      `${BASE}/experiments/${params.experimentId}/prompt-suggestion${q}`,
      {},
      { timeout: 120_000 },
    )
    return res.data
  }
})

export interface UploadAudioSampleParams {
  file: File
  name: string
  description?: string | null
  tags?: string | null
  source_type?: string
}

export const uploadAudioSample = () => ({
  key: ['uploadAudioSample', 'getSampleList'],
  request: async (params: UploadAudioSampleParams): Promise<SampleDatasetResponse> => {
    const query = new URLSearchParams()
    query.set('name', params.name)
    if (params.description) query.set('description', params.description)
    if (params.tags) query.set('tags', params.tags)
    if (params.source_type) query.set('source_type', params.source_type)

    const formData = new FormData()
    formData.append('file', params.file)

    const res = await appInstance.post<SampleDatasetResponse>(
      `${BASE}/samples/upload-audio?${query.toString()}`,
      formData
    )
    return res.data
  }
})

// ============ 프로덕션 AI 설정 Types ============

export interface ProductionAIConfigResponse {
  id: string
  module: string
  pipeline_step: string
  model_name: string
  provider: string
  system_prompt: string | null
  user_prompt_template: string | null
  model_params: string | null
  promoted_from_version_id: string | null
  promoted_by: string | null
  promoted_at: string | null
  is_active: boolean
  description: string | null
  diarization_strategy: string | null
  created_at: string
  updated_at: string
}

export interface PromoteToProductionParams {
  module?: string
  pipeline_step: string
  prompt_version_id?: string | null
  model_name: string
  provider?: string
  system_prompt?: string | null
  user_prompt_template?: string | null
  model_params?: Record<string, unknown> | null
  description?: string | null
}

// ============ 프로덕션 AI 설정 Actions ============

export const getProductionConfigs = (): Action<
  ProductionAIConfigResponse[],
  ProductionAIConfigResponse[]
> => ({
  key: ['getProductionConfigs'],
  request: async (params: { module?: string } = {}): Promise<ProductionAIConfigResponse[]> => {
    const query: Record<string, string | undefined> = {}
    if (params.module) query.module = params.module
    return get<ProductionAIConfigResponse[]>(`${BASE}/production-configs`, query)
  }
})

export const promoteToProduction = () => ({
  key: ['promoteToProduction', 'getProductionConfigs'],
  request: async (params: PromoteToProductionParams): Promise<ProductionAIConfigResponse> => {
    const res = await post<ProductionAIConfigResponse>(`${BASE}/production-configs/promote`, params)
    return (
      (res as { data?: ProductionAIConfigResponse }).data ??
      (res as unknown as ProductionAIConfigResponse)
    )
  }
})

export const getProductionConfigHistory = (): Action<
  ProductionAIConfigResponse[],
  ProductionAIConfigResponse[]
> => ({
  key: ['getProductionConfigHistory'],
  request: async (params: { pipeline_step: string; module?: string }): Promise<ProductionAIConfigResponse[]> => {
    const query: Record<string, string | undefined> = {}
    if (params.module) query.module = params.module
    return get<ProductionAIConfigResponse[]>(
      `${BASE}/production-configs/history/${params.pipeline_step}`,
      query,
    )
  }
})

export const rollbackProductionConfig = () => ({
  key: ['rollbackProductionConfig', 'getProductionConfigs'],
  request: async (params: { configId: string }): Promise<ProductionAIConfigResponse> => {
    const res = await post<ProductionAIConfigResponse>(
      `${BASE}/production-configs/rollback/${params.configId}`,
      {},
    )
    return (
      (res as { data?: ProductionAIConfigResponse }).data ??
      (res as unknown as ProductionAIConfigResponse)
    )
  }
})

// ============ 메타데이터 Types ============

export interface ModelOption {
  value: string
  label: string
  provider: string
  cost_label?: string | null
}

export interface DiarizationStrategyMeta {
  key: string
  label: string
  description: string
  models: ModelOption[]
}

export interface PipelineStepMeta {
  key: string
  label: string
  description: string
  has_prompt: boolean
  models: ModelOption[]
  diarization_strategies: DiarizationStrategyMeta[] | null
}

export interface ModuleMeta {
  key: string
  label: string
  pipeline_steps: PipelineStepMeta[]
}

export interface ExperimentTypeMeta {
  key: string
  label: string
  category: string
  default_system_prompt: string | null
  input_placeholder: string | null
  instruction_placeholder: string | null
}

export interface LabMetadataResponse {
  modules: ModuleMeta[]
  experiment_types: ExperimentTypeMeta[]
  stt_models: ModelOption[]
  stt_diarize_models: ModelOption[]
  llm_models: ModelOption[]
  purpose_labels: Record<string, string>
}

// ============ 메타데이터 Actions ============

export const getLabMetadata = (): Action<
  LabMetadataResponse,
  LabMetadataResponse
> => ({
  key: ['getLabMetadata'],
  request: async (): Promise<LabMetadataResponse> => {
    return get<LabMetadataResponse>(`${BASE}/metadata`)
  }
})

// ============ 비용 대시보드 Actions ============

export const getLabCostSummary = (): Action<
  CostSummaryResponse,
  CostSummaryResponse
> => ({
  key: ['getLabCostSummary'],
  request: async (params: GetCostSummaryParams = {}): Promise<CostSummaryResponse> => {
    const query: Record<string, string | undefined> = {}
    if (params.date_from) query.date_from = params.date_from
    if (params.date_to) query.date_to = params.date_to
    return get<CostSummaryResponse>(`${BASE}/experiments/costs/summary`, query)
  }
})
