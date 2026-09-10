/**
 * Field Note Actions
 * 필드노트 관련 API action 함수들
 *
 * 백엔드: /api/v1/centers/{center_id}/field-notes/...
 * 프록시: /api/proxy/centers/{center_id}/field-notes/...
 *
 * 웹은 "소비·편집·주입" 역할만 담당. 녹음/청크업로드는 모바일 전담.
 */

import {
  deleteResource,
  get,
  patch,
  post,
  postRaw
} from '$lib/services/api/instances'

// ============ 공통 타입 ============

export type FieldNoteStatus = 'recording' | 'paused' | 'completed'
export type TranscriptStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ProcessingStatus =
  | 'idle'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped'
export type StepStatus =
  | 'none'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped'
export type ProcessingStep =
  | 'transcribing'
  | 'refining'
  | 'summarizing'
  | 'generating_note'
  | null
export type SummaryStatus = 'none' | 'generating' | 'completed' | 'failed'
export type EntryType = 'memo' | 'tag'
export type TagCategory = 'observation' | 'behavior' | 'emotion' | 'other'

export interface FieldNoteAudio {
  id: string
  field_note_id: string
  chunk_index: number
  storage_path: string
  duration: number
  transcript: string | null
  transcript_status: TranscriptStatus
  diarized_transcript: string | null
  stt_model_used: string | null
  created_at: string
}

export interface FieldNoteEntry {
  id: string
  field_note_id: string
  entry_type: EntryType
  tag_category: TagCategory | null
  content: string
  timestamp_seconds: number
  created_at: string
}

export type NoteTemplateType = 'default' | 'soap' | 'dap' | 'birp' | 'family_center'

/** AI 분석 — 시점 하이라이트 (t로 재생 점프) */
export interface FieldNoteAnalysisHighlight {
  t: number
  text: string
}

/** AI 분석 — 검사 렌즈: 검사자 질문↔내담자 반응 쌍 */
export interface FieldNoteAnalysisResponse {
  t: number
  prompt: string
  response: string
}

/** AI 분석 — 상담 렌즈: 정서 흐름 타임라인의 한 지점 */
export interface FieldNoteAnalysisMoodPoint {
  t: number
  mood: string
  /** 그 정서가 나온 계기·맥락 (없으면 빈 문자열) */
  trigger?: string
}

/** AI 분석 — 상담 렌즈: 의미 있는 발화(내담자 verbatim) + 짚는 이유 */
export interface FieldNoteAnalysisQuote {
  t: number
  quote: string
  /** 왜 주목할 만한지 한 줄 (해석 아님) */
  note?: string
}

/** AI 분석 — 상담 렌즈: 다음 회기에 살펴볼 지점 */
export interface FieldNoteAnalysisFollowUp {
  point: string
  reason?: string
}

/**
 * AI 분석 탭 구조화 데이터 (요약 스텝에서 생성).
 * 상담 렌즈(narrative/keywords/issues/mood_flow/key_quotes/follow_ups)와
 * 검사 렌즈(responses/observations/quotes)를 함께 담되, 채워지는 쪽은 노트 종류에
 * 따라 다르다 — 데이터 있는 섹션만 렌더한다. 모바일 types.ts와 같은 형태.
 */
export interface FieldNoteAnalysis {
  /** 목록 식별용 짧은 제목 (15자 내외). 구버전 노트는 없음 */
  title?: string | null
  /** 목록 미리보기용 짧은 1문장 */
  summary: string | null
  // 상담 렌즈
  /** 분석 탭 본문 — 회기 흐름 3-5문장(확장 요약). 구버전 노트는 없음 → summary 폴백 */
  narrative?: string | null
  keywords: string[]
  issues: string[]
  /** legacy 단발 정서(구버전 노트) — 신버전은 mood_flow 사용 */
  mood: string | null
  mood_flow?: FieldNoteAnalysisMoodPoint[]
  key_quotes?: FieldNoteAnalysisQuote[]
  follow_ups?: FieldNoteAnalysisFollowUp[]
  highlights: FieldNoteAnalysisHighlight[]
  // 검사 렌즈 (해석 금지 — 정리·위치 찾기)
  responses?: FieldNoteAnalysisResponse[]
  observations?: FieldNoteAnalysisHighlight[]
  quotes?: FieldNoteAnalysisHighlight[]
}

export interface FieldNoteResponse {
  id: string
  center_id: string
  schedule_id: string | null
  author_id: string
  status: FieldNoteStatus
  total_duration: number
  processing_status: ProcessingStatus
  processing_step: ProcessingStep
  failed_step: string | null
  refined_transcript: string | null
  refinement_model: string | null
  transcribe_status: StepStatus
  refine_status: StepStatus
  note_status: StepStatus
  speaker_map: string | null
  nonverbal_markers: string | null
  summary: string | null
  summary_status: SummaryStatus
  summary_generated_at: string | null
  summary_model: string | null
  note_template_type: NoteTemplateType | null
  /** AI 분석 탭 구조화 데이터 — 요약 스텝이 채운다(구버전 노트는 null) */
  analysis: FieldNoteAnalysis | null
  /** 센터 안 일련번호 — 표시명 "필드노트 {n}"의 원천(전문가앱과 동일 규칙) */
  note_number: number | null
  created_at: string
  updated_at: string
}

export interface TokenUsageItem {
  purpose: string | null
  model: string | null
  calls: number
  input_tokens: number
  output_tokens: number
}

export interface FieldNoteDetailResponse extends FieldNoteResponse {
  audios: FieldNoteAudio[]
  entries: FieldNoteEntry[]
  token_usage: TokenUsageItem[]
}

export interface FieldNoteStatusItem {
  schedule_id: string | null
  status: FieldNoteStatus
}

export interface PipelineStepResponse {
  status: string // 'started' | 'already_completed' | 'precondition_not_met' | 'already_processing' | ...
  step: string
  field_note_id: string
  message: string | null
}

export interface AudioDownloadUrlResponse {
  download_url: string
  expires_in: number
  audio_id: string
  chunk_index: number
  duration: number
}

// ============ 필드노트 목록 조회 ============

export interface FieldNoteListResponse {
  items: FieldNoteResponse[]
  total: number
  page: number
  size: number
  pages: number
}

export const getFieldNoteList = () => ({
  key: ['getFieldNoteList'],
  request: async (request: {
    centerId: string
    page?: number
    size?: number
    status?: string
    processingStatus?: string
    linked?: boolean
    authorId?: string
  }): Promise<FieldNoteListResponse> => {
    const { centerId, page = 1, size = 20, status, processingStatus, linked, authorId } = request
    if (!centerId) return { items: [], total: 0, page: 1, size: 20, pages: 0 }
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('size', String(size))
    if (status) params.set('status', status)
    if (processingStatus) params.set('processing_status', processingStatus)
    if (linked !== undefined) params.set('linked', String(linked))
    if (authorId) params.set('author_id', authorId)
    return await get<FieldNoteListResponse>(
      `/centers/${centerId}/field-notes?${params}`
    )
  }
})

// ============ 일정별 필드노트 조회 ============
// 백엔드는 일정에 연결된 필드노트가 없으면 200 + null 을 반환한다.

export const getFieldNoteBySchedule = () => ({
  key: ['getFieldNoteBySchedule'],
  request: async (request: {
    centerId: string
    scheduleId: string
  }): Promise<FieldNoteDetailResponse | null> => {
    const { centerId, scheduleId } = request
    if (!centerId || !scheduleId) return null
    return await get<FieldNoteDetailResponse | null>(
      `/centers/${centerId}/field-notes/by-schedule/${scheduleId}`
    )
  }
})

// ============ 필드노트 상세 조회 ============

export const getFieldNoteDetail = () => ({
  key: ['getFieldNoteDetail'],
  request: async (request: {
    centerId: string
    fieldNoteId: string
  }): Promise<FieldNoteDetailResponse | null> => {
    const { centerId, fieldNoteId } = request
    if (!centerId || !fieldNoteId) return null
    return await get<FieldNoteDetailResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}`
    )
  }
})

// ============ 일정별 상태 일괄 조회 ============

export const getFieldNoteStatuses = () => ({
  key: ['getFieldNoteStatuses'],
  request: async (request: {
    centerId: string
    scheduleIds: string[]
  }): Promise<FieldNoteStatusItem[]> => {
    const { centerId, scheduleIds } = request
    if (!centerId || !scheduleIds?.length) return []
    const params = new URLSearchParams({ schedule_ids: scheduleIds.join(',') })
    return await get<FieldNoteStatusItem[]>(
      `/centers/${centerId}/field-notes/statuses?${params}`
    )
  }
})

// ============ 미연결 필드노트 목록 ============

export const getUnlinkedFieldNotes = () => ({
  key: ['getUnlinkedFieldNotes'],
  request: async (request: {
    centerId: string
  }): Promise<FieldNoteResponse[]> => {
    const { centerId } = request
    if (!centerId) return []
    return await get<FieldNoteResponse[]>(
      `/centers/${centerId}/field-notes/unlinked`
    )
  }
})

// ============ 일정 연결 ============

export const patchLinkSchedule = () => ({
  key: ['patchLinkSchedule'],
  request: async (request: {
    centerId: string
    fieldNoteId: string
    scheduleId: string
  }) => {
    const { centerId, fieldNoteId, scheduleId } = request
    const response = await post<FieldNoteResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}/link-schedule`,
      { schedule_id: scheduleId }
    )
    return response
  }
})

// ============ 화자명 매핑 업데이트 ============

export const patchSpeakerMap = () => ({
  key: ['patchSpeakerMap'],
  request: async (request: {
    centerId: string
    fieldNoteId: string
    speakerMap: Record<string, string>
  }) => {
    const { centerId, fieldNoteId, speakerMap } = request
    const response = await patch<FieldNoteResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}/speaker-map`,
      { speaker_map: speakerMap }
    )
    return response
  }
})

// ============ 개별 파이프라인 스텝 ============

export const postTranscribe = () => ({
  key: ['postTranscribe'],
  request: async (request: { centerId: string; fieldNoteId: string }) => {
    const { centerId, fieldNoteId } = request
    return await postRaw<PipelineStepResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}/transcribe`
    )
  }
})

export const postRefine = () => ({
  key: ['postRefine'],
  request: async (request: { centerId: string; fieldNoteId: string }) => {
    const { centerId, fieldNoteId } = request
    return await postRaw<PipelineStepResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}/refine`
    )
  }
})

// ============ 파이프라인 제어 ============

export const postRunPipeline = () => ({
  key: ['postRunPipeline'],
  request: async (request: { centerId: string; fieldNoteId: string }) => {
    const { centerId, fieldNoteId } = request
    return await postRaw<PipelineStepResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}/run-pipeline`
    )
  }
})

export const postRetryPipeline = () => ({
  key: ['postRetryPipeline'],
  request: async (request: { centerId: string; fieldNoteId: string }) => {
    const { centerId, fieldNoteId } = request
    return await postRaw<FieldNoteDetailResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}/retry-pipeline`
    )
  }
})

export const postGenerateSummary = () => ({
  key: ['postGenerateSummary'],
  request: async (request: { centerId: string; fieldNoteId: string }) => {
    const { centerId, fieldNoteId } = request
    return await postRaw<PipelineStepResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}/generate-summary`
    )
  }
})

export const postGenerateCounselingNote = () => ({
  key: ['postGenerateCounselingNote'],
  request: async (request: {
    centerId: string
    fieldNoteId: string
    noteTemplateType?: NoteTemplateType
  }) => {
    const { centerId, fieldNoteId, noteTemplateType } = request
    return await postRaw<PipelineStepResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}/generate-counseling-note`,
      noteTemplateType ? { note_template_type: noteTemplateType } : undefined
    )
  }
})

// ============ 오디오 다운로드 URL ============

export const getAudioDownloadUrl = () => ({
  key: ['getAudioDownloadUrl'],
  request: async (request: {
    centerId: string
    fieldNoteId: string
    audioId: string
  }): Promise<AudioDownloadUrlResponse | null> => {
    const { centerId, fieldNoteId, audioId } = request
    if (!centerId || !fieldNoteId || !audioId) return null
    return await get<AudioDownloadUrlResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}/audio/${audioId}/download-url`
    )
  }
})

// ============ 전사 내보내기 ============

export interface ExportTranscriptResponse {
  content: string
  format: string
  filename: string
}

export const getExportTranscript = () => ({
  key: ['getExportTranscript'],
  request: async (request: {
    centerId: string
    fieldNoteId: string
    format: 'text' | 'json'
  }): Promise<ExportTranscriptResponse | null> => {
    const { centerId, fieldNoteId, format } = request
    if (!centerId || !fieldNoteId) return null
    return await get<ExportTranscriptResponse>(
      `/centers/${centerId}/field-notes/${fieldNoteId}/export?format=${format}`
    )
  }
})

// ============ 센터 노트 설정 ============

export interface CenterNotePreferenceResponse {
  id: string | null
  center_id: string
  default_template_type: NoteTemplateType
}

export const getCenterNotePreference = () => ({
  key: ['getCenterNotePreference'],
  request: async (request: {
    centerId: string
  }): Promise<CenterNotePreferenceResponse | null> => {
    const { centerId } = request
    if (!centerId) return null
    return await get<CenterNotePreferenceResponse>(
      `/centers/${centerId}/note-preferences`
    )
  }
})

export const patchCenterNotePreference = () => ({
  key: ['patchCenterNotePreference'],
  request: async (request: {
    centerId: string
    defaultTemplateType: NoteTemplateType
  }) => {
    const { centerId, defaultTemplateType } = request
    return await patch<CenterNotePreferenceResponse>(
      `/centers/${centerId}/note-preferences`,
      { default_template_type: defaultTemplateType }
    )
  }
})

// ============ 삭제 ============

export const deleteFieldNote = () => ({
  key: ['deleteFieldNote'],
  request: async (request: { centerId: string; fieldNoteId: string }) => {
    const { centerId, fieldNoteId } = request
    return await deleteResource<void>(
      `/centers/${centerId}/field-notes/${fieldNoteId}`
    )
  }
})
